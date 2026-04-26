package com.hellotimepro.springboot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class FavoriteId implements Serializable {
  @Column(name = "user_id")
  private UUID userId;
  @Column(name = "capsule_id")
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
