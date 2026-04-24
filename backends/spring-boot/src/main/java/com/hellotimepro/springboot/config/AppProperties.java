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
}
