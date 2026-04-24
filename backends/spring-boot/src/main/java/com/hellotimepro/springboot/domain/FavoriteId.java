package com.hellotimepro.springboot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class FavoriteId implements Serializable {
  @Column(name = "user_id")
  private String userId;
  @Column(name = "capsule_id")
  private String capsuleId;

  public FavoriteId() {}

  public FavoriteId(String userId, String capsuleId) {
    this.userId = userId;
    this.capsuleId = capsuleId;
  }

  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getCapsuleId() { return capsuleId; }
  public void setCapsuleId(String capsuleId) { this.capsuleId = capsuleId; }

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
