import { resolve } from "node:path";

export const specRoot = resolve(import.meta.dir, "../../../spec");

const num = (v: string | undefined, fallback: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const bool = (v: string | undefined) => ["1", "true", "yes", "on"].includes((v ?? "").toLowerCase());

export const env = {
  port: num(process.env.PORT, 29030),
  serviceName: process.env.SERVICE_NAME ?? "hellotime-pro",
  serviceVersion: "2.0.0",
  dbDriver: (process.env.DB_DRIVER ?? "postgres").toLowerCase() as "postgres" | "sqlite",
  dbUrl:
    process.env.DB_URL ??
    "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  accessTokenTtlSeconds: num(process.env.ACCESS_TOKEN_TTL_SECONDS, 3600),
  refreshTokenTtlSeconds: num(process.env.REFRESH_TOKEN_TTL_SECONDS, 7 * 24 * 3600),
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),
  loginRateLimitPerMinute: num(process.env.LOGIN_RATE_LIMIT_PER_MINUTE, 10),
  llm: {
    enabled: bool(process.env.LLM_ENABLED),
    provider: process.env.LLM_PROVIDER ?? "openai",
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "gpt-4.1-mini",
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 30000),
    // 瞬时网络/TLS 错误（如 SSL EOF）的额外重试次数
    maxRetries: num(process.env.LLM_MAX_RETRIES, 2),
    retryBackoffMs: num(process.env.LLM_RETRY_BACKOFF_MS, 400),
    // chat（默认，多数兼容网关只支持它）| responses | auto
    apiStyle: process.env.LLM_API_STYLE ?? "chat",
    // 应用自有 UA（OpenCode Go 要求；库默认 UA 会被 Cloudflare 1010 封禁）
    userAgent: process.env.LLM_USER_AGENT || "hellotimepro",
    // x-opencode-session：进程内稳定的会话 ID
    sessionId: process.env.LLM_SESSION_ID || crypto.randomUUID(),
  },
};
