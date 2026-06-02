/**
 * 服务端运行时配置（从环境变量读）。客户端不要 import 此文件。
 */
import "server-only";

const num = (v: string | undefined, fallback: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const bool = (v: string | undefined) => v === "1" || v === "true";

export const env = {
  port: num(process.env.PORT, 7177),
  serviceName: process.env.SERVICE_NAME ?? "hellotime-pro",
  serviceVersion: process.env.SERVICE_VERSION ?? "0.1.0",
  dbDriver: (process.env.DB_DRIVER ?? "postgres").toLowerCase() as "postgres" | "sqlite",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  accessTokenTtlSeconds: num(process.env.ACCESS_TOKEN_TTL_SECONDS, 3600),
  refreshTokenTtlSeconds: num(process.env.REFRESH_TOKEN_TTL_SECONDS, 7 * 24 * 3600),
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),
  loginRateLimitPerMinute: num(process.env.LOGIN_RATE_LIMIT_PER_MINUTE, 10),
  llm: {
    enabled: bool(process.env.LLM_ENABLED),
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "gpt-4.1-mini",
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 30000),
    // 瞬时网络/TLS 错误（如 SSL EOF、连接被代理掐断）的额外重试次数
    maxRetries: num(process.env.LLM_MAX_RETRIES, 2),
    retryBackoffMs: num(process.env.LLM_RETRY_BACKOFF_MS, 400),
    // 避免被网关机器人防护按默认 UA 封禁（Cloudflare error 1010）
    userAgent:
      process.env.LLM_USER_AGENT ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
};
