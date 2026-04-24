package com.hellotimepro.springboot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "capsules")
public class CapsuleEntity {
  @Id
  private String id;
  @Column(name = "owner_id")
  private String ownerId;
  private String code;
  private String title;
  private String content;
  @Column(name = "open_at")
  private OffsetDateTime openAt;
  @Column(name = "in_plaza")
  private boolean inPlaza;
  @Column(name = "favorite_count")
  private int favoriteCount;
  @Column(name = "created_at")
  private OffsetDateTime createdAt;
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getOwnerId() { return ownerId; }
  public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
  public String getCode() { return code; }
  public void setCode(String code) { this.code = code; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getContent() { return content; }
  public void setContent(String content) { this.content = content; }
  public OffsetDateTime getOpenAt() { return openAt; }
  public void setOpenAt(OffsetDateTime openAt) { this.openAt = openAt; }
  public boolean isInPlaza() { return inPlaza; }
  public void setInPlaza(boolean inPlaza) { this.inPlaza = inPlaza; }
  public int getFavoriteCount() { return favoriteCount; }
  public void setFavoriteCount(int favoriteCount) { this.favoriteCount = favoriteCount; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
