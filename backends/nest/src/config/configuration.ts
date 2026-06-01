import * as path from 'path';

export interface AppConfig {
  port: number;
  dbDriver: 'postgres' | 'sqlite';
  dbUrl: string;
  jwtSecret: string;
  jwtAlgorithm: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  bcryptRounds: number;
  loginRateLimitPerMinute: number;
  llmEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmTimeoutMs: number;
  llmMaxRetries: number;
  llmRetryBackoffMs: number;
  llmApiStyle: string;
  llmUserAgent: string;
  seedDemo: boolean;
  repoRoot: string;
  serviceName: string;
  serviceVersion: string;
}

export default (): AppConfig => {
  const dbDriver = (process.env.DB_DRIVER || 'postgres') as 'postgres' | 'sqlite';
  const repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../..');

  let dbUrl = process.env.DB_URL || '';
  if (!dbUrl) {
    if (dbDriver === 'sqlite') {
      dbUrl = `sqlite://${repoRoot}/data/sqlite/hellotime-nest.db`;
    } else {
      dbUrl = 'postgresql://hellotime:hellotime@localhost:55432/hellotime';
    }
  }

  return {
    port: parseInt(process.env.PORT || '29040', 10),
    dbDriver,
    dbUrl,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    jwtAlgorithm: process.env.JWT_ALGORITHM || 'HS256',
    accessTokenTtlSeconds: parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '3600', 10),
    refreshTokenTtlSeconds: parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || '604800', 10),
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    loginRateLimitPerMinute: parseInt(process.env.LOGIN_RATE_LIMIT_PER_MINUTE || '10', 10),
    llmEnabled: process.env.LLM_ENABLED !== 'false',
    llmProvider: process.env.LLM_PROVIDER || 'anthropic',
    llmModel: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.anthropic.com/v1',
    llmApiKey: process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10),
    llmMaxRetries: parseInt(process.env.LLM_MAX_RETRIES || '2', 10),
    llmRetryBackoffMs: parseInt(process.env.LLM_RETRY_BACKOFF_MS || '400', 10),
    llmApiStyle: process.env.LLM_API_STYLE || 'chat',
    llmUserAgent:
      process.env.LLM_USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    seedDemo: process.env.SEED_DEMO !== 'false',
    repoRoot,
    serviceName: 'hellotime-pro',
    serviceVersion: '0.1.0',
  };
};
