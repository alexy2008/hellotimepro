import "server-only";

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { env } from "@/lib/env";
import type { CapsuleSuggestion, CapsuleSuggestionRequest } from "@/types";

function promptTemplate(): string {
  const path = join(process.cwd(), "..", "..", "spec", "llm", "capsule-suggestion.prompt.md");
  if (existsSync(path)) return readFileSync(path, "utf8");
  return (
    '你是中文写作助手。基于标题 {TITLE} 为用户生成一段 260~400 字的'
    + '时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。'
    + '只返回严格 JSON：{"content":"...","openInDays":30}。'
  );
}

function buildPrompt(title: string): string {
  return promptTemplate().replace("{TITLE}", title);
}

function clampDays(raw: unknown): number {
  let n: number;
  if (typeof raw === "number" && !Number.isNaN(raw)) n = Math.floor(raw);
  else if (typeof raw === "string") n = parseInt(raw.trim(), 10);
  else throw new Error("openInDays must be integer");
  if (!Number.isFinite(n)) throw new Error("openInDays must be integer");
  if (n < 1) n = 1;
  if (n > 3650) n = 3650;
  return n;
}

function truncateContent(text: string): string {
  const t = text.trim();
  return t.length > 5000 ? t.slice(0, 5000) : t;
}

function localFallback(title: string): { content: string; days: number } {
  const days = [30, 90, 180, 365][Math.floor(Math.random() * 4)];
  const content =
    `写下《${title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。`
    + "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n"
    + "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、"
    + "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n"
    + "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。";
  return { content, days };
}

interface LlmStructuredResult {
  content: string;
  openInDays: number;
}

async function callLlmChat(prompt: string): Promise<LlmStructuredResult> {
  if (!env.llm.enabled || !env.llm.apiKey.trim()) {
    throw new Error("LLM disabled");
  }
  const url = env.llm.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.llm.timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.llm.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.llm.model,
        messages: [
          {
            role: "system",
            content:
              "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
              + "JSON 必须包含字符串字段 content 和整数字段 openInDays。",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 900,
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const body: unknown = await resp.json();
    // OpenAI 兼容：choices[0].message.content
    const text =
      // @ts-expect-error — runtime shape
      body?.choices?.[0]?.message?.content as string | undefined;
    if (!text || typeof text !== "string") throw new Error("LLM 没返回内容");
    return parseJsonObject(text);
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonObject(text: string): LlmStructuredResult {
  let raw = text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("LLM output 不是合法 JSON");
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  if (!parsed || typeof parsed !== "object") throw new Error("LLM JSON 不是对象");
  const obj = parsed as { content?: unknown; openInDays?: unknown };
  return {
    content: truncateContent(String(obj.content ?? "")),
    openInDays: clampDays(obj.openInDays),
  };
}

export async function suggestCapsule(req: CapsuleSuggestionRequest): Promise<CapsuleSuggestion> {
  const title = req.title.trim();
  let content: string;
  let days: number;
  let generatedBy = "local-template";
  try {
    const r = await callLlmChat(buildPrompt(title));
    if (!r.content) throw new Error("empty content");
    content = r.content;
    days = r.openInDays;
    generatedBy = `openai:${env.llm.model}`;
  } catch (e) {
    console.warn("[suggestCapsule] fallback to local:", (e as Error).message);
    const f = localFallback(title);
    content = f.content;
    days = f.days;
  }
  const openAt = new Date(Date.now() + days * 24 * 3600 * 1000);
  return {
    content,
    openInDays: days,
    openAt: openAt.toISOString(),
    generatedBy,
    cached: false,
  };
}
