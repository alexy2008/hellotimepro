<?php

namespace App\Services;

use App\Exceptions\ApiError;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * AI 创作辅助：胶囊正文建议（suggestion，LLM 失败时回退本地模板）与主题推荐
 * （recommendations，锦上添花，LLM 不可用时返回空列表）。
 */
class SuggestionService
{
    public function __construct(private readonly LlmClient $llm)
    {
    }

    public function suggestion(array $body): array
    {
        $title = trim((string) ($body['title'] ?? ''));
        if (mb_strlen($title) > 60) throw new ApiError(422, 'VALIDATION_ERROR', 'title 最多 60 字符');
        $autoTitle = $title === '';

        $generatedBy = 'local-template';
        $resultTitle = null;
        $content = null;
        $days = 0;
        $ok = false;

        try {
            $node = $this->llm->generateCapsuleSuggestion($this->buildSuggestionPrompt($title));
            $rawContent = trim((string) ($node['content'] ?? ''));
            if (mb_strlen($rawContent) > 5000) $rawContent = mb_substr($rawContent, 0, 5000);
            if ($rawContent === '') throw new \RuntimeException('empty content');
            $rawDays = $this->coerceOpenInDays($node['openInDays'] ?? null);
            if ($autoTitle) {
                $genTitle = $this->truncateText((string) ($node['title'] ?? ''), 60);
                if ($genTitle === '') throw new \RuntimeException('empty title');
                $resultTitle = $genTitle;
            }
            $content = $rawContent;
            $days = $rawDays;
            $generatedBy = $this->llm->provider() . ':' . $this->llm->model();
            $ok = true;
        } catch (Throwable $e) {
            Log::warning('Capsule suggestion LLM failed; using local fallback: ' . $e->getMessage());
        }

        if (!$ok) {
            $fallback = $this->suggestionFallback($autoTitle, $title);
            $resultTitle = $autoTitle ? $fallback['title'] : null;
            $content = $fallback['content'];
            $days = $fallback['days'];
        }

        $openAt = (new DateTimeImmutable("+{$days} days", new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        return [
            'title' => $resultTitle,
            'content' => $content,
            'openInDays' => $days,
            'openAt' => $openAt,
            'generatedBy' => $generatedBy,
            'cached' => false,
        ];
    }

    public function recommendations(array $query): array
    {
        $count = (int) ($query['count'] ?? 4);
        if ($count < 3 || $count > 8) throw new ApiError(422, 'VALIDATION_ERROR', 'count 范围 3-8');

        $items = [];
        $generatedBy = 'none';
        try {
            $node = $this->llm->generateCapsuleRecommendations($this->buildRecommendationPrompt($count));
            $items = $this->parseRecommendationItems($node['items'] ?? null, $count);
            $generatedBy = $items === [] ? 'none' : $this->llm->provider() . ':' . $this->llm->model();
        } catch (Throwable $e) {
            // 锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。
            Log::info('Capsule recommendations unavailable; returning empty list: ' . $e->getMessage());
        }

        return ['items' => $items, 'generatedBy' => $generatedBy, 'cached' => false];
    }

    private function buildSuggestionPrompt(string $title): string
    {
        $default = '你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。'
            . '为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。'
            . '只返回严格 JSON：{"title":"...","content":"...","openInDays":30}。';
        $template = $this->loadPrompt('capsule-suggestion.prompt.md', $default);
        return str_replace(['{TITLE_OR_EMPTY}', '{TITLE}'], $title, $template);
    }

    private function buildRecommendationPrompt(int $count): string
    {
        $default = '你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。'
            . '每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。'
            . '只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。';
        $template = $this->loadPrompt('capsule-recommendation.prompt.md', $default);
        return str_replace('{COUNT}', (string) $count, $template);
    }

    private function loadPrompt(string $file, string $default): string
    {
        $path = $this->appRoot() . '/spec/llm/' . $file;
        $template = is_file($path) ? (string) file_get_contents($path) : '';
        return trim($template) === '' ? $default : $template;
    }

    private function coerceOpenInDays(mixed $value): int
    {
        if ($value === null) throw new \RuntimeException('openInDays missing');
        $n = is_int($value) ? $value : (is_numeric($value) ? (int) $value : null);
        if ($n === null) throw new \RuntimeException('openInDays not a number');
        return max(1, min(3650, $n));
    }

    private function parseRecommendationItems(mixed $raw, int $limit): array
    {
        if (!is_array($raw)) return [];
        $items = [];
        $seen = [];
        foreach ($raw as $entry) {
            if (!is_array($entry)) continue;
            $title = $this->truncateText((string) ($entry['title'] ?? ''), 60);
            $hint = $this->truncateText((string) ($entry['hint'] ?? ''), 80);
            $days = is_numeric($entry['openInDays'] ?? null) ? max(1, min(3650, (int) $entry['openInDays'])) : null;
            if ($title === '' || $hint === '' || $days === null || isset($seen[$title])) continue;
            $seen[$title] = true;
            $items[] = ['title' => $title, 'hint' => $hint, 'openInDays' => $days];
            if (count($items) >= $limit) break;
        }
        return $items;
    }

    private function truncateText(string $raw, int $limit): string
    {
        $cleaned = trim(preg_replace('/[\r\n]+/', ' ', $raw));
        $cleaned = trim(preg_replace('/^[#*`　 "\'《》【】]+|[#*`　 "\'《》【】]+$/u', '', $cleaned));
        return mb_strlen($cleaned) > $limit ? mb_substr($cleaned, 0, $limit) : $cleaned;
    }

    private function suggestionFallback(bool $autoTitle, string $title): array
    {
        if ($autoTitle) {
            return self::FALLBACK_CAPSULES[array_rand(self::FALLBACK_CAPSULES)];
        }
        $days = [30, 90, 180, 365][array_rand([30, 90, 180, 365])];
        $content = "写下《{$title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。"
            . "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n"
            . "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、"
            . "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n"
            . "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。";
        return ['title' => $title, 'content' => $content, 'days' => $days];
    }

    private const FALLBACK_CAPSULES = [
        ['title' => '写给一个月后的自己', 'days' => 30,
            'content' => "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。"],
        ['title' => '下个季度想完成的一件事', 'days' => 90,
            'content' => "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。无论结果如何，请记得为当初愿意开始的自己鼓一次掌。"],
        ['title' => '明年生日想对自己说的话', 'days' => 365,
            'content' => "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。"],
        ['title' => '三年后还在做喜欢的事吗', 'days' => 1095,
            'content' => "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。此刻它带给我很多快乐，也带来一些迷茫。\n\n如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。无论如何，别忘了当初让你眼睛发亮的那个瞬间。"],
        ['title' => '五年后的我在哪座城市', 'days' => 1825,
            'content' => "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？此刻的我对未来有许多想象，也有一点不安。\n\n等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。不管落脚在哪，希望你过得踏实、自在。"],
    ];

    private function appRoot(): string
    {
        return env('APP_ROOT') ?: dirname(base_path(), 2);
    }
}
