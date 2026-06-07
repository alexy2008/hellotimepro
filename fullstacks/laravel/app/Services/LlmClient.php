<?php

namespace App\Services;

use App\Exceptions\LlmException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * 结构化 JSON 生成的 LLM 客户端。日志规范、网关重试、chat 风格跳过 /responses 等坑见 docs/dev-notes.md。
 * 契约测试默认 LLM_ENABLED=false 时立即抛异常，由上层走本地兜底；HTTP 路径不在测试链上。
 *
 * 日志规范（CLAUDE.md）：请求前 INFO `LLM request`、成功 INFO `LLM response`、失败 WARNING `LLM error`。
 */
class LlmClient
{
    /**
     * 读配置：优先 getenv()（直接读进程环境，可靠），回退 Laravel env()。
     * `php artisan serve` 的 worker 在 variables_order 不含 E 时，仅继承（非 .env）的变量
     * 可能不进 $_SERVER/$_ENV，导致 env() 读不到；getenv() 不受此限。
     */
    private function conf(string $key, string $default): string
    {
        $value = getenv($key);
        if ($value === false || $value === '') {
            $value = env($key);
        }
        return ($value === false || $value === null || $value === '') ? $default : (string)$value;
    }

    public function enabled(): bool
    {
        return strtolower($this->conf('LLM_ENABLED', 'false')) === 'true' && $this->apiKey() !== '';
    }

    public function provider(): string
    {
        return $this->conf('LLM_PROVIDER', 'openai');
    }

    public function model(): string
    {
        return $this->conf('LLM_MODEL', 'gpt-4.1-mini');
    }

    private function apiKey(): string
    {
        return $this->conf('LLM_API_KEY', '');
    }

    private function baseUrl(): string
    {
        return rtrim($this->conf('LLM_BASE_URL', 'https://api.openai.com/v1'), '/');
    }

    private function apiStyle(): string
    {
        return $this->conf('LLM_API_STYLE', 'chat');
    }

    private function timeoutMs(): int
    {
        return (int)$this->conf('LLM_TIMEOUT_MS', '30000');
    }

    private function maxRetries(): int
    {
        return (int)$this->conf('LLM_MAX_RETRIES', '2');
    }

    private function backoffMs(): int
    {
        return (int)$this->conf('LLM_RETRY_BACKOFF_MS', '400');
    }

    private function userAgent(): string
    {
        return $this->conf(
            'LLM_USER_AGENT',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        );
    }

    public function generateCapsuleSuggestion(string $prompt): array
    {
        return $this->generateStructuredJson($prompt, $this->suggestionSpec());
    }

    public function generateCapsuleRecommendations(string $prompt): array
    {
        return $this->generateStructuredJson($prompt, $this->recommendationSpec());
    }

    private function generateStructuredJson(string $prompt, array $spec): array
    {
        if (!$this->enabled()) {
            throw new LlmException('LLM is disabled or missing API key');
        }

        switch ($this->apiStyle()) {
            case 'responses':
                return $this->generateWithResponses($prompt, $spec);
            case 'auto':
                try {
                    return $this->generateWithResponses($prompt, $spec);
                } catch (LlmException $e) {
                    Log::info("Responses API unavailable ({$e->getMessage()}); falling back to chat completions");
                    return $this->generateWithChat($prompt, $spec, true);
                }
            default:
                return $this->generateWithChat($prompt, $spec, true);
        }
    }

    private function generateWithResponses(string $prompt, array $spec): array
    {
        $payload = [
            'model' => $this->model(),
            'input' => $prompt,
            'max_output_tokens' => $spec['max_tokens'],
            'text' => ['format' => ['type' => 'json_schema', 'name' => $spec['schema_name'], 'strict' => true, 'schema' => $spec['schema']]],
        ];
        return $this->parseJsonObject($this->extractResponsesText($this->postJson($this->baseUrl() . '/responses', $payload)));
    }

    private function generateWithChat(string $prompt, array $spec, bool $disableThinking): array
    {
        $build = function (bool $thinking) use ($prompt, $spec): array {
            $payload = [
                'model' => $this->model(),
                'messages' => [
                    ['role' => 'system', 'content' => $spec['system_prompt']],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'max_tokens' => $spec['max_tokens'],
            ];
            if ($thinking) $payload['thinking'] = ['type' => 'disabled'];
            return $payload;
        };

        try {
            return $this->parseJsonObject($this->extractChatText($this->postJson($this->baseUrl() . '/chat/completions', $build($disableThinking))));
        } catch (LlmException $e) {
            if ($e->status !== 400) throw $e;
            // 某些网关不认 thinking 字段，去掉重试一次。
            return $this->parseJsonObject($this->extractChatText($this->postJson($this->baseUrl() . '/chat/completions', $build(false))));
        }
    }

    /** 向 url POST JSON；瞬时网络/TLS 错误按配置重试，HTTP 4xx/5xx 与坏 JSON 不重试。 */
    private function postJson(string $url, array $payload): array
    {
        $attempts = max(1, $this->maxRetries() + 1);
        $lastError = null;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            Log::info("LLM request  model={$this->model()} url={$url} attempt={$attempt}/{$attempts}");
            $start = hrtime(true);
            try {
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey(),
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => $this->userAgent(),
                ])
                    ->connectTimeout((int)ceil($this->timeoutMs() / 1000))
                    ->timeout((int)ceil($this->timeoutMs() / 1000))
                    ->withBody(json_encode($payload, JSON_UNESCAPED_UNICODE), 'application/json')
                    ->post($url);

                $elapsed = $this->elapsedMs($start);
                $status = $response->status();
                if ($status < 200 || $status >= 300) {
                    Log::warning("LLM error    model={$this->model()} elapsed_ms={$elapsed} status={$status}");
                    throw new LlmException("HTTP {$status}: " . $response->body(), $status);
                }

                $parsed = json_decode($response->body(), true);
                if (!is_array($parsed)) {
                    Log::warning("LLM error    model={$this->model()} elapsed_ms={$elapsed} error=invalid-json");
                    throw new LlmException('LLM response was not valid JSON');
                }

                Log::info("LLM response model={$this->model()} elapsed_ms={$elapsed} tokens={$this->extractTokens($parsed)}");
                return $parsed;
            } catch (LlmException $e) {
                // HTTP / JSON 错误：不重试。
                throw $e;
            } catch (Throwable $e) {
                $elapsed = $this->elapsedMs($start);
                $willRetry = $attempt < $attempts;
                Log::warning("LLM error    model={$this->model()} elapsed_ms={$elapsed} error={$e->getMessage()}" . ($willRetry ? ' (will retry)' : ''));
                $lastError = $e;
                if ($willRetry) usleep($this->backoffMs() * $attempt * 1000);
            }
        }

        throw new LlmException($lastError?->getMessage() ?? 'LLM request failed');
    }

    private function extractTokens(array $body): string
    {
        $usage = $body['usage'] ?? null;
        if (!is_array($usage)) return 'n/a';
        $total = (int)($usage['total_tokens'] ?? 0);
        if ($total > 0) return (string)$total;
        $sum = (int)($usage['input_tokens'] ?? 0) + (int)($usage['output_tokens'] ?? 0);
        return $sum > 0 ? (string)$sum : 'n/a';
    }

    private function extractChatText(array $body): string
    {
        $choices = $body['choices'] ?? null;
        if (!is_array($choices) || $choices === []) throw new LlmException('LLM chat response missing choices');
        $content = $choices[0]['message']['content'] ?? null;
        if (!is_string($content) || trim($content) === '') throw new LlmException('LLM chat response missing content');
        return $content;
    }

    private function extractResponsesText(array $body): string
    {
        $ot = $body['output_text'] ?? null;
        if (is_string($ot) && trim($ot) !== '') return $ot;
        foreach (($body['output'] ?? []) as $item) {
            foreach ((is_array($item) ? ($item['content'] ?? []) : []) as $entry) {
                $txt = is_array($entry) ? ($entry['text'] ?? null) : null;
                if (is_string($txt) && trim($txt) !== '') return $txt;
            }
        }
        throw new LlmException('LLM response did not contain output text');
    }

    private function parseJsonObject(string $raw): array
    {
        $text = trim($raw);
        if (str_starts_with($text, '```')) {
            $text = trim(preg_replace('/\A```[a-zA-Z]*\s*/', '', preg_replace('/\s*```\z/', '', $text)));
        }
        $decoded = json_decode($text, true);
        if (is_array($decoded)) return $decoded;

        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start === false || $end === false || $end <= $start) {
            throw new LlmException('LLM output was not valid JSON');
        }
        $decoded = json_decode(substr($text, $start, $end - $start + 1), true);
        if (!is_array($decoded)) throw new LlmException('LLM output was not valid JSON');
        return $decoded;
    }

    private function elapsedMs(int $startNs): int
    {
        return (int)((hrtime(true) - $startNs) / 1_000_000);
    }

    private function suggestionSpec(): array
    {
        return [
            'schema_name' => 'capsule_suggestion',
            'schema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['title', 'content', 'openInDays'],
                'properties' => [
                    'title' => ['type' => 'string'],
                    'content' => ['type' => 'string'],
                    'openInDays' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 3650],
                ],
            ],
            'system_prompt' => '你只返回严格 JSON 对象，不要 Markdown、代码块或解释。'
                . 'JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。',
            'max_tokens' => 900,
        ];
    }

    private function recommendationSpec(): array
    {
        return [
            'schema_name' => 'capsule_recommendations',
            'schema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['items'],
                'properties' => [
                    'items' => [
                        'type' => 'array',
                        'minItems' => 3,
                        'maxItems' => 8,
                        'items' => [
                            'type' => 'object',
                            'additionalProperties' => false,
                            'required' => ['title', 'hint', 'openInDays'],
                            'properties' => [
                                'title' => ['type' => 'string'],
                                'hint' => ['type' => 'string'],
                                'openInDays' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 3650],
                            ],
                        ],
                    ],
                ],
            ],
            'system_prompt' => '你只返回严格 JSON 对象，不要 Markdown、代码块或解释。'
                . 'JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。',
            'max_tokens' => 900,
        ];
    }
}
