// OpenAI 兼容 LLM 客户端：胶囊正文生成与推荐主题共用。
// 含结构化日志（LLM request/response/error）、瞬时错误重试、浏览器 UA、api 风格路由。
import { env } from "./config";

export class LlmClientError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmClientError";
    this.status = status;
  }
}

interface SchemaSpec {
  schemaName: string;
  schema: Record<string, unknown>;
  system: string;
  maxTokens: number;
}

const SUGGESTION_SPEC: SchemaSpec = {
  schemaName: "capsule_suggestion",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "content", "openInDays"],
    properties: {
      title: { type: "string" },
      content: { type: "string" },
      openInDays: { type: "integer", minimum: 1, maximum: 3650 },
    },
  },
  system:
    "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
    "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。",
  maxTokens: 900,
};

const RECOMMENDATION_SPEC: SchemaSpec = {
  schemaName: "capsule_recommendations",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "hint", "openInDays"],
          properties: {
            title: { type: "string" },
            hint: { type: "string" },
            openInDays: { type: "integer", minimum: 1, maximum: 3650 },
          },
        },
      },
    },
  },
  system:
    "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
    "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
  maxTokens: 900,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function baseUrl(): string {
  return env.llm.baseUrl.replace(/\/+$/, "");
}

function extractTokens(body: any): string {
  const usage = body?.usage;
  if (!usage) return "n/a";
  if (typeof usage.total_tokens === "number" && usage.total_tokens > 0) return String(usage.total_tokens);
  const sum = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
  return sum > 0 ? String(sum) : "n/a";
}

function parseJsonObject(text: string): any {
  let raw = text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  }
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new LlmClientError("LLM output JSON object not found");
  }
}

// 对瞬时网络/TLS 错误（如 SSL EOF、超时）重试；HTTP 4xx/5xx 与坏 JSON 不重试。
async function postJson(url: string, payload: Record<string, unknown>): Promise<any> {
  const model = String(payload.model ?? env.llm.model);
  const data = JSON.stringify(payload);
  const attempts = Math.max(1, env.llm.maxRetries + 1);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`LLM request  model=${model} url=${url} attempt=${attempt}/${attempts}`);
    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), env.llm.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.llm.apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": env.llm.userAgent,
        },
        body: data,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const elapsed = Date.now() - start;
      if (!resp.ok) {
        // 服务端明确响应（含 Cloudflare 1010）——非瞬时错误，不重试
        const detail = (await resp.text()).slice(0, 500);
        console.warn(`LLM error    model=${model} elapsed_ms=${elapsed} status=${resp.status}`);
        throw new LlmClientError(`HTTP ${resp.status}: ${detail}`, resp.status);
      }
      const text = await resp.text();
      let body: any;
      try {
        body = JSON.parse(text);
      } catch {
        console.warn(`LLM error    model=${model} elapsed_ms=${elapsed} error=invalid-json`);
        throw new LlmClientError("LLM response was not valid JSON");
      }
      console.log(`LLM response model=${model} elapsed_ms=${elapsed} tokens=${extractTokens(body)}`);
      return body;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof LlmClientError) throw e; // status / 坏 JSON：已记录，不重试
      const elapsed = Date.now() - start;
      const willRetry = attempt < attempts;
      console.warn(
        `LLM error    model=${model} elapsed_ms=${elapsed} error=${e}${willRetry ? " (will retry)" : ""}`,
      );
      lastErr = e;
      if (!willRetry) throw new LlmClientError(String(e));
      await sleep(env.llm.retryBackoffMs * attempt);
    }
  }
  throw new LlmClientError(String(lastErr));
}

async function viaResponses(prompt: string, spec: SchemaSpec): Promise<any> {
  const body = await postJson(`${baseUrl()}/responses`, {
    model: env.llm.model,
    input: prompt,
    max_output_tokens: spec.maxTokens,
    text: { format: { type: "json_schema", name: spec.schemaName, strict: true, schema: spec.schema } },
  });
  const text = body.output_text || body.output?.[0]?.content?.[0]?.text;
  if (!text) throw new LlmClientError("LLM response did not contain output text");
  return parseJsonObject(text);
}

async function viaChat(prompt: string, spec: SchemaSpec): Promise<any> {
  const body = await postJson(`${baseUrl()}/chat/completions`, {
    model: env.llm.model,
    messages: [
      { role: "system", content: spec.system },
      { role: "user", content: prompt },
    ],
    max_tokens: spec.maxTokens,
    thinking: { type: "disabled" }, // 生成任务不需要推理
  });
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new LlmClientError("LLM chat response did not contain message content");
  return parseJsonObject(content);
}

async function generateStructuredJson(prompt: string, spec: SchemaSpec): Promise<any> {
  if (!env.llm.enabled || !env.llm.apiKey.trim()) {
    throw new LlmClientError("LLM is disabled or missing API key");
  }
  const style = env.llm.apiStyle;
  if (style === "responses") return viaResponses(prompt, spec);
  if (style === "auto") {
    try {
      return await viaResponses(prompt, spec);
    } catch (e) {
      console.log(`Responses API unavailable (${e}); falling back to chat completions`);
      return viaChat(prompt, spec);
    }
  }
  return viaChat(prompt, spec); // 默认 chat：跳过多数网关不支持的 /responses
}

export async function generateSuggestion(prompt: string): Promise<any> {
  return generateStructuredJson(prompt, SUGGESTION_SPEC);
}

export async function generateRecommendations(prompt: string): Promise<any> {
  return generateStructuredJson(prompt, RECOMMENDATION_SPEC);
}
