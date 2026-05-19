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
import java.util.UUID;
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
    // favorite_count 是冗余计数器，必须和 favorites 行变更处在同一事务。
    // Postgres 路径会拿胶囊行写锁；SQLite 依赖单写事务和原子 UPDATE。
    CapsuleEntity capsule = lockCapsule(capsuleId);
    if (!capsule.isInPlaza()) throw ApiException.notFound("胶囊不存在");
    if (capsule.getOwnerId().equals(user.getId())) throw ApiException.badRequest("不能收藏自己创建的胶囊");

    FavoriteId id = new FavoriteId(user.getId(), capsule.getId());
    FavoriteEntity existing = favorites.findById(id).orElse(null);
    if (existing != null) {
      return new FavoriteResult(capsule.getId().toString(), capsule.getFavoriteCount(), existing.getCreatedAt());
    }

    OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
    FavoriteEntity favorite = new FavoriteEntity();
    favorite.setId(id);
    favorite.setCreatedAt(now);
    favorites.save(favorite);
    capsules.incrementFavoriteCount(capsule.getId());
    int newCount = capsules.findById(capsule.getId())
        .map(CapsuleEntity::getFavoriteCount)
        .orElse(capsule.getFavoriteCount() + 1);
    return new FavoriteResult(capsule.getId().toString(), newCount, now);
  }

  @Transactional
  public void removeFavorite(UserEntity user, String capsuleId) {
    // 取消收藏同样在事务里删除 favorites 行并递减计数，保持 spec 的 I2 不变式。
    UUID uuid = UUID.fromString(capsuleId);
    CapsuleEntity capsule = capsules.findById(uuid).orElse(null);
    if (capsule == null) return;
    FavoriteId id = new FavoriteId(user.getId(), capsule.getId());
    if (favorites.existsById(id)) {
      favorites.deleteById(id);
      capsules.decrementFavoriteCount(capsule.getId());
    }
  }

  private CapsuleEntity lockCapsule(String id) {
    UUID uuid = UUID.fromString(id);
    if ("postgres".equals(props.getDbDriver())) {
      // JPA 的 PESSIMISTIC_WRITE 对应 SELECT ... FOR UPDATE，避免并发收藏时计数漂移。
      return capsules.findByIdForUpdate(uuid).orElseThrow(() -> ApiException.notFound("胶囊不存在"));
    }
    return capsules.findById(uuid).orElseThrow(() -> ApiException.notFound("胶囊不存在"));
  }
}
