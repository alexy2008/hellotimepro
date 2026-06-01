import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import { AppConfig } from '../config/configuration';

/** LLM 调用错误。status 非空表示 HTTP 错误（明确响应，不重试）。 */
export class LlmClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmClientError';
  }
}

export interface LlmSchemaSpec {
  schemaName: string;
  schema: Record<string, unknown>;
  system: string;
  maxTokens: number;
}

const SUGGESTION_SPEC: LlmSchemaSpec = {
  schemaName: 'capsule_suggestion',
  schema: {
    type: 'object',
    additionalProperties: false,
    // strict 模式要求 required 覆盖全部 properties；空标题模式用 title，已带标题时忽略。
    required: ['title', 'content', 'openInDays'],
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      openInDays: { type: 'integer', minimum: 1, maximum: 3650 },
    },
  },
  system:
    '你只返回严格 JSON 对象，不要 Markdown、代码块或解释。' +
    'JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。',
  maxTokens: 900,
};

const RECOMMENDATION_SPEC: LlmSchemaSpec = {
  schemaName: 'capsule_recommendations',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        minItems: 3,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'hint', 'openInDays'],
          properties: {
            title: { type: 'string' },
            hint: { type: 'string' },
            openInDays: { type: 'integer', minimum: 1, maximum: 3650 },
          },
        },
      },
    },
  },
  system:
    '你只返回严格 JSON 对象，不要 Markdown、代码块或解释。' +
    'JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。',
  maxTokens: 900,
};

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private cfg<K extends keyof AppConfig>(key: K, fallback: AppConfig[K]): AppConfig[K] {
    return this.config.get(key, { infer: true }) ?? fallback;
  }

  async generateSuggestion(prompt: string): Promise<any> {
    return this.generateStructuredJson(prompt, SUGGESTION_SPEC);
  }

  async generateRecommendations(prompt: string): Promise<any> {
    return this.generateStructuredJson(prompt, RECOMMENDATION_SPEC);
  }

  // ---------- 路由：chat（默认）| responses | auto ----------

  private async generateStructuredJson(prompt: string, spec: LlmSchemaSpec): Promise<any> {
    const enabled = this.cfg('llmEnabled', false);
    const apiKey = this.cfg('llmApiKey', '');
    if (!enabled || !apiKey.trim()) {
      throw new LlmClientError('LLM is disabled or missing API key');
    }
    const style = this.cfg('llmApiStyle', 'chat');
    if (style === 'responses') return this.viaResponses(prompt, spec);
    if (style === 'auto') {
      try {
        return await this.viaResponses(prompt, spec);
      } catch (e) {
        this.logger.log(`Responses API unavailable (${e}); falling back to chat completions`);
        return this.viaChat(prompt, spec);
      }
    }
    return this.viaChat(prompt, spec); // 默认 chat：跳过多数网关不支持的 /responses
  }

  // ---------- /responses ----------

  private async viaResponses(prompt: string, spec: LlmSchemaSpec): Promise<any> {
    const url = this.baseUrl() + '/responses';
    const body = await this.postJson(url, {
      model: this.cfg('llmModel', 'gpt-4.1-mini'),
      input: prompt,
      max_output_tokens: spec.maxTokens,
      text: {
        format: { type: 'json_schema', name: spec.schemaName, strict: true, schema: spec.schema },
      },
    });
    const text = body.output_text || body.output?.[0]?.content?.[0]?.text;
    if (!text) throw new LlmClientError('LLM response did not contain output text');
    return this.parseJsonObject(text);
  }

  // ---------- /chat/completions ----------

  private async viaChat(prompt: string, spec: LlmSchemaSpec): Promise<any> {
    const url = this.baseUrl() + '/chat/completions';
    const body = await this.postJson(url, {
      model: this.cfg('llmModel', 'gpt-4.1-mini'),
      messages: [
        { role: 'system', content: spec.system },
        { role: 'user', content: prompt },
      ],
      max_tokens: spec.maxTokens,
      // 本应用生成任务不需要推理，固定关闭 thinking 以提速。
      thinking: { type: 'disabled' },
    });
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new LlmClientError('LLM chat response did not contain message content');
    return this.parseJsonObject(content);
  }

  // ---------- HTTP（日志 + 重试 + UA）----------

  private async postJson(url: string, payload: Record<string, unknown>): Promise<any> {
    const payloadStr = JSON.stringify(payload);
    const model = String(payload.model ?? this.cfg('llmModel', 'gpt-4.1-mini'));
    const timeoutMs = this.cfg('llmTimeoutMs', 30000);
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.cfg('llmApiKey', '')}`,
      // 避免被网关机器人防护按默认 UA 封禁（Cloudflare error 1010）
      'User-Agent': this.cfg('llmUserAgent', ''),
      'Content-Length': Buffer.byteLength(payloadStr),
    };

    const attempts = Math.max(1, this.cfg('llmMaxRetries', 2) + 1);
    const backoff = this.cfg('llmRetryBackoffMs', 400);
    let lastErr: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.logger.log(`LLM request  model=${model} url=${url} attempt=${attempt}/${attempts}`);
      const start = Date.now();
      try {
        const { status, text } = await this.requestOnce(url, payloadStr, headers, timeoutMs);
        const elapsed = Date.now() - start;
        if (status >= 400) {
          // 服务端明确响应（含 Cloudflare 1010）——非瞬时错误，不重试
          this.logger.warn(`LLM error    model=${model} elapsed_ms=${elapsed} status=${status}`);
          throw new LlmClientError(`HTTP ${status}: ${text.slice(0, 500)}`, status);
        }
        let body: any;
        try {
          body = JSON.parse(text);
        } catch {
          // 拿到响应但非合法 JSON——重试无益
          this.logger.warn(`LLM error    model=${model} elapsed_ms=${elapsed} error=invalid-json`);
          throw new LlmClientError('LLM response was not valid JSON');
        }
        this.logger.log(`LLM response model=${model} elapsed_ms=${elapsed} tokens=${this.extractTokens(body)}`);
        return body;
      } catch (e) {
        if (e instanceof LlmClientError) throw e; // status / 坏 JSON：已记录，不重试
        // 瞬时网络/TLS 错误（含超时、SSL EOF）——在剩余次数内重试
        const elapsed = Date.now() - start;
        const willRetry = attempt < attempts;
        this.logger.warn(
          `LLM error    model=${model} elapsed_ms=${elapsed} error=${e}${willRetry ? ' (will retry)' : ''}`,
        );
        lastErr = e;
        if (!willRetry) throw new LlmClientError(String(e));
        await this.sleep(backoff * attempt);
      }
    }
    throw new LlmClientError(String(lastErr));
  }

  private requestOnce(
    url: string,
    payloadStr: string,
    headers: Record<string, string | number>,
    timeoutMs: number,
  ): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text: data }));
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('LLM request timeout'));
      });
      req.on('error', reject);
      req.write(payloadStr);
      req.end();
    });
  }

  // ---------- 工具 ----------

  private baseUrl(): string {
    return this.cfg('llmBaseUrl', 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  private extractTokens(body: any): string {
    const usage = body?.usage;
    if (!usage) return 'n/a';
    const total = usage.total_tokens;
    if (typeof total === 'number' && total > 0) return String(total);
    const sum = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
    return sum > 0 ? String(sum) : 'n/a';
  }

  private parseJsonObject(text: string): any {
    let raw = text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
    }
    try {
      return JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
      throw new LlmClientError('LLM output JSON object not found');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
