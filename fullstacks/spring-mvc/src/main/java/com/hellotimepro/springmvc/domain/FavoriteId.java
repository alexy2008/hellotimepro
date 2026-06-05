package com.hellotimepro.springmvc.domain;

import com.hellotimepro.springmvc.db.CrossDbUuidJdbcType;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.JdbcType;

@Embeddable
public class FavoriteId implements Serializable {
  @Column(name = "user_id")
  @JdbcType(CrossDbUuidJdbcType.class)
  private UUID userId;
  @Column(name = "capsule_id")
  @JdbcType(CrossDbUuidJdbcType.class)
  private UUID capsuleId;

  public FavoriteId() {}

  public FavoriteId(UUID userId, UUID capsuleId) {
    this.userId = userId;
    this.capsuleId = capsuleId;
  }

  public UUID getUserId() { return userId; }
  public void setUserId(UUID userId) { this.userId = userId; }
  public UUID getCapsuleId() { return capsuleId; }
  public void setCapsuleId(UUID capsuleId) { this.capsuleId = capsuleId; }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof FavoriteId that)) return false;
    return Objects.equals(userId, that.userId) && Objects.equals(capsuleId, that.capsuleId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(userId, capsuleId);
  }
}
