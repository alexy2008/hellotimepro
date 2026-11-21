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
    CapsuleEntity capsule = capsules.findForMutation(CapsuleIds.parse(capsuleId, "capsuleId"),
            "postgres".equals(props.getDbDriver()))
        .orElseThrow(() -> ApiException.notFound("胶囊不存在"));

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
    // 与 add 一样先锁胶囊行，序列化同一胶囊上的并发取消；否则两个请求都可能
    // 看到 favorite 存在，第二个 DELETE 0 行后仍把计数再减一次。
    // 幂等只针对「胶囊不存在 / 原本未收藏」（204）；UUID 格式不合法与 fastapi 一致返回 422。
    UUID uuid = CapsuleIds.parse(capsuleId, "capsuleId");
    CapsuleEntity capsule = capsules.findForMutation(uuid, "postgres".equals(props.getDbDriver())).orElse(null);
    if (capsule == null) return;
    FavoriteId id = new FavoriteId(user.getId(), capsule.getId());
    if (favorites.existsById(id)) {
      favorites.deleteById(id);
      capsules.decrementFavoriteCount(capsule.getId());
    }
  }

}
