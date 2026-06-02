import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { env } from "~/server/lib/env";
import type { CapsuleRecommendation, CapsuleRecommendationList } from "~/types";
import { generateStructuredJson } from "~/server/services/llm";

const MIN_ITEMS = 3;
const MAX_ITEMS = 8;

const SYSTEM_PROMPT =
  "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
  + "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。";

function promptTemplate(): string {
  const path = join(process.cwd(), "..", "..", "spec", "llm", "capsule-recommendation.prompt.md");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return (
    "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。"
    + "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。"
    + '只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。'
  );
}

function buildPrompt(count: number): string {
  return promptTemplate().replace("{COUNT}", String(count));
}

function clampDays(raw: unknown): number | null {
  let n: number;
  if (typeof raw === "boolean") return null;
  if (typeof raw === "number" && !Number.isNaN(raw)) n = Math.floor(raw);
  else if (typeof raw === "string") n = parseInt(raw.trim(), 10);
  else return null;
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(3650, n));
}

function clean(text: unknown, limit: number): string {
  let cleaned = String(text ?? "").trim().replace(/[\r\n]+/g, " ");
  cleaned = cleaned.replace(/^[#*`\s　"'《》【】]+|[#*`\s　"'《》【】]+$/g, "").trim();
  return [...cleaned].slice(0, limit).join("");
}

function parseItems(raw: unknown): CapsuleRecommendation[] {
  const items: CapsuleRecommendation[] = [];
  if (!Array.isArray(raw)) return items;
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const title = clean(e.title, 60);
    const hint = clean(e.hint, 80);
    const days = clampDays(e.openInDays);
    if (!title || !hint || days === null) continue;
    if (seen.has(title)) continue;
    seen.add(title);
    items.push({ title, hint, openInDays: days });
  }
  return items;
}

// 推荐为锦上添花：LLM 不可用时返回空列表，不做本地兜底、不报错。
export async function getCapsuleRecommendations(
  count: number,
): Promise<CapsuleRecommendationList> {
  const n = Math.max(MIN_ITEMS, Math.min(MAX_ITEMS, count));
  let items: CapsuleRecommendation[] = [];
  try {
    const r = await generateStructuredJson({ prompt: buildPrompt(n), system: SYSTEM_PROMPT });
    items = parseItems(r.items).slice(0, n);
  } catch (e) {
    console.info("[recommendation] unavailable, returning empty list:", (e as Error).message);
  }
  return {
    items,
    generatedBy: items.length > 0 ? `openai:${env.llm.model}` : "none",
    cached: false,
  };
}
