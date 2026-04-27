package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.domain.CapsuleEntity;
import com.hellotimepro.springboot.domain.FavoriteId;
import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springboot.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springboot.dto.Dtos.UserBrief;
import com.hellotimepro.springboot.dto.Dtos.UserOut;
import com.hellotimepro.springboot.repository.FavoriteRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class MapperService {
  private final FavoriteRepository favorites;

  public MapperService(FavoriteRepository favorites) {
    this.favorites = favorites;
  }

  public UserOut user(UserEntity u) {
    return new UserOut(u.getId().toString(), u.getEmail(), u.getNickname(), u.getAvatarId(), u.getCreatedAt());
  }

  public CapsuleDetail detail(CapsuleEntity c, UserEntity owner, String viewerId, boolean includeContent) {
    boolean opened = c.getOpenAt().isBefore(now()) || c.getOpenAt().isEqual(now());
    boolean favorited = viewerId != null && favorites.existsById(new FavoriteId(UUID.fromString(viewerId), c.getId()));
    return new CapsuleDetail(
        c.getId().toString(),
        c.getCode(),
        c.getTitle(),
        new UserBrief(owner.getNickname(), owner.getAvatarId()),
        c.getOpenAt(),
        c.getCreatedAt(),
        c.isInPlaza(),
        c.getFavoriteCount(),
        opened,
        opened && includeContent ? c.getContent() : null,
        favorited);
  }

  public CapsuleListItem listItem(CapsuleEntity c, UserEntity owner, boolean favorited, OffsetDateTime favoritedAt) {
    boolean opened = c.getOpenAt().isBefore(now()) || c.getOpenAt().isEqual(now());
    String preview = null;
    if (opened && c.getContent() != null) {
      String raw = c.getContent().strip();
      preview = raw.length() > 80 ? raw.substring(0, 80) + "…" : raw;
    }
    return new CapsuleListItem(
        c.getId().toString(),
        c.getCode(),
        c.getTitle(),
        new UserBrief(owner.getNickname(), owner.getAvatarId()),
        c.getOpenAt(),
        c.getCreatedAt(),
        c.isInPlaza(),
        c.getFavoriteCount(),
        opened,
        favorited,
        favoritedAt,
        preview);
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(ZoneOffset.UTC);
  }
}
