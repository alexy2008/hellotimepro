package com.hellotimepro.springboot.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "favorites")
public class FavoriteEntity {
  @EmbeddedId
  private FavoriteId id;
  @Column(name = "created_at")
  private OffsetDateTime createdAt;

  public FavoriteId getId() { return id; }
  public void setId(FavoriteId id) { this.id = id; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
