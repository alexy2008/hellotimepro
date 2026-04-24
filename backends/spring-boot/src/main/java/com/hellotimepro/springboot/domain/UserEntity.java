package com.hellotimepro.springboot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
public class UserEntity {
  @Id
  private String id;
  private String email;
  @Column(name = "password_hash")
  private String passwordHash;
  private String nickname;
  @Column(name = "avatar_id")
  private String avatarId;
  @Column(name = "created_at")
  private OffsetDateTime createdAt;
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getPasswordHash() { return passwordHash; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
  public String getNickname() { return nickname; }
  public void setNickname(String nickname) { this.nickname = nickname; }
  public String getAvatarId() { return avatarId; }
  public void setAvatarId(String avatarId) { this.avatarId = avatarId; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
