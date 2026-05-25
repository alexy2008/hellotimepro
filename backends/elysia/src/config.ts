const num = (v: string | undefined, fallback: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const bool = (v: string | undefined) => ["1", "true", "yes", "on"].includes((v ?? "").toLowerCase());

export const env = {
  port: num(process.env.PORT, 29030),
  serviceName: process.env.SERVICE_NAME ?? "hellotime-pro",
  serviceVersion: process.env.SERVICE_VERSION ?? "0.1.0",
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
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "gpt-4.1-mini",
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 30000),
  },
};
