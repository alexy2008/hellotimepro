import { env } from "~/server/lib/env";

// OpenAI 兼容的 chat-only LLM 客户端：多数兼容网关只支持 /chat/completions。
// 按 LLM 日志规范输出 request/response/error，并对瞬时网络/TLS 错误重试。

export class LlmError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

function chatUrl(): string {
  return env.llm.baseUrl.replace(/\/+$/, "") + "/chat/completions";
}

function extractChatText(body: unknown): string {
  const text = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof text === "string" && text.trim()) return text;
  throw new LlmError("LLM chat response did not contain message content");
}

function extractTokens(body: unknown): string {
  const u = (body as { usage?: Record<string, number> })?.usage;
  if (!u) return "n/a";
  const total = u.total_tokens ?? (u.input_tokens ?? 0) + (u.output_tokens ?? 0);
  return total ? String(total) : "n/a";
}

export function parseJsonObject(text: string): Record<string, unknown> {
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
    if (start === -1 || end <= start) throw new LlmError("LLM output 不是合法 JSON");
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  if (!parsed || typeof parsed !== "object") throw new LlmError("LLM JSON 不是对象");
  return parsed as Record<string, unknown>;
}

async function postJson(payload: Record<string, unknown>): Promise<unknown> {
  const url = chatUrl();
  const model = String(payload.model ?? env.llm.model);
  const attempts = Math.max(1, env.llm.maxRetries + 1);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.info(`LLM request  model=${model} url=${url} attempt=${attempt}/${attempts}`);
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), env.llm.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.llm.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": env.llm.userAgent,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const elapsed = Date.now() - t0;
      if (!resp.ok) {
        // 明确 HTTP 响应（含 Cloudflare 1010）——非瞬时错误，不重试
        console.warn(`LLM error    model=${model} elapsed_ms=${elapsed} status=${resp.status}`);
        throw new LlmError(`HTTP ${resp.status}`, resp.status);
      }
      const body: unknown = await resp.json();
      console.info(
        `LLM response model=${model} elapsed_ms=${elapsed} tokens=${extractTokens(body)}`,
      );
      return body;
    } catch (e) {
      const elapsed = Date.now() - t0;
      // HTTP 错误（带 status）不重试，直接抛出
      if (e instanceof LlmError && e.status) throw e;
      const willRetry = attempt < attempts;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `LLM error    model=${model} elapsed_ms=${elapsed} error=${msg}${willRetry ? " (will retry)" : ""}`,
      );
      lastErr = e;
      if (!willRetry) throw e instanceof LlmError ? e : new LlmError(msg);
      await new Promise((r) => setTimeout(r, env.llm.retryBackoffMs * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new LlmError("LLM request exhausted retries");
}

// generateStructuredJson 走 chat/completions，返回解析后的 JSON 对象。
export async function generateStructuredJson(opts: {
  prompt: string;
  system: string;
  maxTokens?: number;
}): Promise<Record<string, unknown>> {
  if (!env.llm.enabled || !env.llm.apiKey.trim()) {
    throw new LlmError("LLM disabled or missing API key");
  }
  const body = await postJson({
    model: env.llm.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
    max_tokens: opts.maxTokens ?? 900,
  });
  return parseJsonObject(extractChatText(body));
}
