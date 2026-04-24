package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.domain.CapsuleEntity;
import com.hellotimepro.springboot.domain.FavoriteEntity;
import com.hellotimepro.springboot.domain.FavoriteId;
import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.FavoriteResult;
import com.hellotimepro.springboot.repository.CapsuleRepository;
import com.hellotimepro.springboot.repository.FavoriteRepository;
import com.hellotimepro.springboot.web.ApiException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FavoriteService {
  private final AppProperties props;
  private final CapsuleRepository capsules;
  private final FavoriteRepository favorites;

  public FavoriteService(AppProperties props, CapsuleRepository capsules, FavoriteRepository favorites) {
    this.props = props;
    this.capsules = capsules;
    this.favorites = favorites;
  }

  @Transactional
  public FavoriteResult addFavorite(UserEntity user, String capsuleId) {
    CapsuleEntity capsule = lockCapsule(capsuleId);
    if (!capsule.isInPlaza()) throw ApiException.notFound("胶囊不存在");
    if (capsule.getOwnerId().equals(user.getId())) throw ApiException.badRequest("不能收藏自己创建的胶囊");

    FavoriteId id = new FavoriteId(user.getId(), capsule.getId());
    FavoriteEntity existing = favorites.findById(id).orElse(null);
    if (existing != null) {
      return new FavoriteResult(capsule.getId(), capsule.getFavoriteCount(), existing.getCreatedAt());
    }

    OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
    FavoriteEntity favorite = new FavoriteEntity();
    favorite.setId(id);
    favorite.setCreatedAt(now);
    favorites.save(favorite);
    capsule.setFavoriteCount(capsule.getFavoriteCount() + 1);
    capsules.save(capsule);
    return new FavoriteResult(capsule.getId(), capsule.getFavoriteCount(), now);
  }

  @Transactional
  public void removeFavorite(UserEntity user, String capsuleId) {
    CapsuleEntity capsule = capsules.findById(capsuleId).orElse(null);
    if (capsule == null) return;
    FavoriteId id = new FavoriteId(user.getId(), capsule.getId());
    if (favorites.existsById(id)) {
      favorites.deleteById(id);
      if (capsule.getFavoriteCount() > 0) {
        capsule.setFavoriteCount(capsule.getFavoriteCount() - 1);
        capsules.save(capsule);
      }
    }
  }

  private CapsuleEntity lockCapsule(String id) {
    if ("postgres".equals(props.getDbDriver())) {
      return capsules.findByIdForUpdate(id).orElseThrow(() -> ApiException.notFound("胶囊不存在"));
    }
    return capsules.findById(id).orElseThrow(() -> ApiException.notFound("胶囊不存在"));
  }
}
