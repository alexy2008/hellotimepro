package com.hellotimepro.springmvc.domain;

import com.hellotimepro.springmvc.db.CrossDbOffsetDateTimeJdbcType;
import com.hellotimepro.springmvc.db.CrossDbUuidJdbcType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcType;

@Entity
@Table(name = "refresh_tokens")
public class RefreshTokenEntity {
  @Id
  @JdbcType(CrossDbUuidJdbcType.class)
  private UUID id;
  @Column(name = "user_id")
  @JdbcType(CrossDbUuidJdbcType.class)
  private UUID userId;
  @Column(name = "token_hash")
  private String tokenHash;
  @Column(name = "family_id")
  @JdbcType(CrossDbUuidJdbcType.class)
  private UUID familyId;
  @Column(name = "expires_at")
  @JdbcType(CrossDbOffsetDateTimeJdbcType.class)
  private OffsetDateTime expiresAt;
  @Column(name = "created_at")
  @JdbcType(CrossDbOffsetDateTimeJdbcType.class)
  private OffsetDateTime createdAt;
  @Column(name = "revoked_at")
  @JdbcType(CrossDbOffsetDateTimeJdbcType.class)
  private OffsetDateTime revokedAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }
  public UUID getUserId() { return userId; }
  public void setUserId(UUID userId) { this.userId = userId; }
  public String getTokenHash() { return tokenHash; }
  public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
  public UUID getFamilyId() { return familyId; }
  public void setFamilyId(UUID familyId) { this.familyId = familyId; }
  public OffsetDateTime getExpiresAt() { return expiresAt; }
  public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
  public OffsetDateTime getRevokedAt() { return revokedAt; }
  public void setRevokedAt(OffsetDateTime revokedAt) { this.revokedAt = revokedAt; }
}
