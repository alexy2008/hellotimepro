package com.hellotimepro.springboot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "refresh_tokens")
public class RefreshTokenEntity {
  @Id
  private String id;
  @Column(name = "user_id")
  private String userId;
  @Column(name = "token_hash")
  private String tokenHash;
  @Column(name = "family_id")
  private String familyId;
  @Column(name = "expires_at")
  private OffsetDateTime expiresAt;
  @Column(name = "created_at")
  private OffsetDateTime createdAt;
  @Column(name = "revoked_at")
  private OffsetDateTime revokedAt;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getTokenHash() { return tokenHash; }
  public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
  public String getFamilyId() { return familyId; }
  public void setFamilyId(String familyId) { this.familyId = familyId; }
  public OffsetDateTime getExpiresAt() { return expiresAt; }
  public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
  public OffsetDateTime getRevokedAt() { return revokedAt; }
  public void setRevokedAt(OffsetDateTime revokedAt) { this.revokedAt = revokedAt; }
}
