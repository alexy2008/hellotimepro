import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import { AppConfig } from '../config/configuration';

@Injectable()
export class CapsuleSuggestionService {
  private readonly logger = new Logger(CapsuleSuggestionService.name);

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private promptTemplate(): string {
    const repoRoot = this.config.get('repoRoot', { infer: true }) ?? process.cwd();
    const promptPath = path.join(repoRoot, 'spec', 'llm', 'capsule-suggestion.prompt.md');
    try {
      return fs.readFileSync(promptPath, 'utf-8');
    } catch {
      return (
        '你是中文写作助手。基于标题 {TITLE} 为用户生成一段 260~400 字的' +
        '时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。' +
        '只返回严格 JSON：{"content":"...","openInDays":30}。'
      );
    }
  }

  private buildPrompt(title: string): string {
    return this.promptTemplate().replace('{TITLE}', title);
  }

  private localFallback(title: string): { content: string; openInDays: number } {
    const dayOptions = [30, 90, 180, 365];
    const openInDays = dayOptions[Math.floor(Math.random() * dayOptions.length)];
    const content =
      `写下《${title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。` +
      '如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n' +
      '我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、' +
      '正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n' +
      '记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。';
    return { content, openInDays };
  }

  private async postJson(url: string, payload: object, apiKey: string, timeoutMs: number): Promise<object> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          });
        },
      );
      req.on('timeout', () => { req.destroy(); reject(new Error('LLM request timeout')); });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private parseJsonObject(text: string): object {
    let raw = text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    try {
      return JSON.parse(raw);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
      throw new Error('No JSON object found');
    }
  }

  private coerceOpenInDays(raw: unknown): number {
    let days: number;
    if (typeof raw === 'boolean') throw new Error('openInDays must be integer');
    if (typeof raw === 'number') days = Math.round(raw);
    else if (typeof raw === 'string') days = parseInt(raw, 10);
    else throw new Error('openInDays must be integer');
    if (isNaN(days)) throw new Error('openInDays is NaN');
    return Math.min(3650, Math.max(1, days));
  }

  private async callResponses(prompt: string, apiKey: string, model: string, baseUrl: string, timeoutMs: number) {
    const url = baseUrl.replace(/\/$/, '') + '/responses';
    const resp = await this.postJson(url, {
      model,
      input: prompt,
      max_output_tokens: 900,
      text: {
        format: {
          type: 'json_schema',
          name: 'capsule_suggestion',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['content', 'openInDays'],
            properties: {
              content: { type: 'string' },
              openInDays: { type: 'integer', minimum: 1, maximum: 3650 },
            },
          },
        },
      },
    }, apiKey, timeoutMs) as any;

    const outputText =
      resp.output_text ||
      resp.output?.[0]?.content?.[0]?.text;
    if (!outputText) throw new Error('No output text');
    return this.parseJsonObject(outputText) as any;
  }

  private async callChatCompletions(prompt: string, apiKey: string, model: string, baseUrl: string, timeoutMs: number) {
    const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
    const resp = await this.postJson(url, {
      model,
      messages: [
        { role: 'system', content: '你只返回严格 JSON 对象，不要 Markdown、代码块或解释。JSON 必须包含字符串字段 content 和整数字段 openInDays。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 900,
    }, apiKey, timeoutMs) as any;

    const content = resp.choices?.[0]?.message?.content;
    if (!content) throw new Error('No message content');
    return this.parseJsonObject(content) as any;
  }

  async suggest(title: string) {
    const prompt = this.buildPrompt(title.trim());
    const enabled = this.config.get('llmEnabled', { infer: true }) ?? false;
    const apiKey = this.config.get('llmApiKey', { infer: true }) ?? '';
    const model = this.config.get('llmModel', { infer: true }) ?? 'claude-haiku-4-5-20251001';
    const baseUrl = this.config.get('llmBaseUrl', { infer: true }) ?? 'https://api.anthropic.com/v1';
    const timeoutMs = this.config.get('llmTimeoutMs', { infer: true }) ?? 30000;
    const provider = this.config.get('llmProvider', { infer: true }) ?? 'anthropic';

    let result: { content: string; openInDays: number };
    let generatedBy = 'local-template';

    if (enabled && apiKey?.trim()) {
      try {
        let llmResult: any;
        try {
          llmResult = await this.callResponses(prompt, apiKey, model, baseUrl, timeoutMs);
        } catch {
          llmResult = await this.callChatCompletions(prompt, apiKey, model, baseUrl, timeoutMs);
        }
        const content = String(llmResult.content ?? '').trim().slice(0, 5000);
        const openInDays = this.coerceOpenInDays(llmResult.openInDays);
        if (!content) throw new Error('empty content');
        result = { content, openInDays };
        generatedBy = `${provider}:${model}`;
      } catch (e) {
        this.logger.warn(`LLM failed, using fallback: ${e}`);
        result = this.localFallback(title);
      }
    } else {
      result = this.localFallback(title);
    }

    const openAt = new Date(Date.now() + result.openInDays * 86400 * 1000);
    return {
      content: result.content,
      openInDays: result.openInDays,
      openAt,
      generatedBy,
      cached: false,
    };
  }
}
