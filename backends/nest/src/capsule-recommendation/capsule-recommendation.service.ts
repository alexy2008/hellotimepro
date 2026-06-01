import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from '../config/configuration';
import { LlmClientService } from '../llm/llm-client.service';

const MIN_ITEMS = 3;
const MAX_ITEMS = 8;

export interface RecommendationItem {
  title: string;
  hint: string;
  openInDays: number;
}

export interface RecommendationList {
  items: RecommendationItem[];
  generatedBy: string;
  cached: boolean;
}

@Injectable()
export class CapsuleRecommendationService {
  private readonly logger = new Logger(CapsuleRecommendationService.name);

  constructor(
    private readonly config: ConfigService<AppConfig>,
    private readonly llm: LlmClientService,
  ) {}

  private promptTemplate(): string {
    const repoRoot = this.config.get('repoRoot', { infer: true }) ?? process.cwd();
    const promptPath = path.join(repoRoot, 'spec', 'llm', 'capsule-recommendation.prompt.md');
    try {
      return fs.readFileSync(promptPath, 'utf-8');
    } catch {
      return (
        '你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。' +
        '每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。' +
        '只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。'
      );
    }
  }

  private buildPrompt(count: number): string {
    return this.promptTemplate().replace('{COUNT}', String(count));
  }

  private clampDays(raw: unknown): number | null {
    let days: number;
    if (typeof raw === 'boolean') return null;
    if (typeof raw === 'number') days = Math.round(raw);
    else if (typeof raw === 'string') days = parseInt(raw, 10);
    else return null;
    if (isNaN(days)) return null;
    return Math.min(3650, Math.max(1, days));
  }

  private clean(text: unknown, limit: number): string {
    let cleaned = String(text ?? '').trim().replace(/[\r\n]+/g, ' ');
    cleaned = cleaned.replace(/^[#*`　 "'《》【】]+|[#*`　 "'《》【】]+$/g, '').trim();
    return [...cleaned].slice(0, limit).join('');
  }

  private parseItems(raw: unknown): RecommendationItem[] {
    const items: RecommendationItem[] = [];
    if (!Array.isArray(raw)) return items;
    const seen = new Set<string>();
    for (const entry of raw) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const title = this.clean(e.title, 60);
      const hint = this.clean(e.hint, 80);
      const days = this.clampDays(e.openInDays);
      if (!title || !hint || days === null) continue;
      if (seen.has(title)) continue;
      seen.add(title);
      items.push({ title, hint, openInDays: days });
    }
    return items;
  }

  /** 推荐为锦上添花：LLM 不可用时返回空列表，不做本地兜底、不报错。 */
  async getRecommendations(count: number, _locale: string): Promise<RecommendationList> {
    const n = Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, count));
    let items: RecommendationItem[] = [];
    try {
      const result = await this.llm.generateRecommendations(this.buildPrompt(n));
      items = this.parseItems(result.items).slice(0, n);
    } catch (e) {
      this.logger.log(`Capsule recommendations unavailable; returning empty list: ${e}`);
    }

    const provider = this.config.get('llmProvider', { infer: true }) ?? 'openai';
    const model = this.config.get('llmModel', { infer: true }) ?? 'gpt-4.1-mini';
    return {
      items,
      generatedBy: items.length > 0 ? `${provider}:${model}` : 'none',
      cached: false,
    };
  }
}
