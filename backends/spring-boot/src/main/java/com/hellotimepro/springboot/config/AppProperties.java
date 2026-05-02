package com.hellotimepro.springboot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
  private String serviceName = "hellotime-pro";
  private String serviceVersion = "0.1.0";
  private String dbDriver = "postgres";
  private String jwtSecret = "dev-secret-change-me";
  private int accessTokenTtlSeconds = 3600;
  private int refreshTokenTtlSeconds = 604800;
  private int loginRateLimitPerMinute = 10;
  private String repoRoot = "../..";
  private Llm llm = new Llm();

  public String getServiceName() { return serviceName; }
  public void setServiceName(String serviceName) { this.serviceName = serviceName; }
  public String getServiceVersion() { return serviceVersion; }
  public void setServiceVersion(String serviceVersion) { this.serviceVersion = serviceVersion; }
  public String getDbDriver() { return dbDriver; }
  public void setDbDriver(String dbDriver) { this.dbDriver = dbDriver; }
  public String getJwtSecret() { return jwtSecret; }
  public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }
  public int getAccessTokenTtlSeconds() { return accessTokenTtlSeconds; }
  public void setAccessTokenTtlSeconds(int accessTokenTtlSeconds) { this.accessTokenTtlSeconds = accessTokenTtlSeconds; }
  public int getRefreshTokenTtlSeconds() { return refreshTokenTtlSeconds; }
  public void setRefreshTokenTtlSeconds(int refreshTokenTtlSeconds) { this.refreshTokenTtlSeconds = refreshTokenTtlSeconds; }
  public int getLoginRateLimitPerMinute() { return loginRateLimitPerMinute; }
  public void setLoginRateLimitPerMinute(int loginRateLimitPerMinute) { this.loginRateLimitPerMinute = loginRateLimitPerMinute; }
  public String getRepoRoot() { return repoRoot; }
  public void setRepoRoot(String repoRoot) { this.repoRoot = repoRoot; }
  public Llm getLlm() { return llm; }
  public void setLlm(Llm llm) { this.llm = llm; }

  public static class Llm {
    private boolean enabled = false;
    private String provider = "openai";
    private String baseUrl = "https://api.openai.com/v1";
    private String apiKey = "";
    private String model = "gpt-4.1-mini";
    private int timeoutMs = 30000;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public int getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(int timeoutMs) { this.timeoutMs = timeoutMs; }
  }
}
