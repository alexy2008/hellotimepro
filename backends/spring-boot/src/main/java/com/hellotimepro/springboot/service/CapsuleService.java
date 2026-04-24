package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.domain.CapsuleEntity;
import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springboot.dto.Dtos.CreateCapsuleRequest;
import com.hellotimepro.springboot.repository.CapsuleRepository;
import com.hellotimepro.springboot.repository.FavoriteRepository;
import com.hellotimepro.springboot.repository.UserRepository;
import com.hellotimepro.springboot.web.ApiException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CapsuleService {
  private static final char[] CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();
  private final SecureRandom random = new SecureRandom();
  private final CapsuleRepository capsules;
  private final UserRepository users;
  private final FavoriteRepository favorites;
  private final MapperService mapper;

  public CapsuleService(CapsuleRepository capsules, UserRepository users, FavoriteRepository favorites,
      MapperService mapper) {
    this.capsules = capsules;
    this.users = users;
    this.favorites = favorites;
    this.mapper = mapper;
  }

  @Transactional
  public CapsuleDetail create(UserEntity owner, CreateCapsuleRequest req) {
    OffsetDateTime now = now();
    OffsetDateTime openAt = req.openAt().withOffsetSameInstant(ZoneOffset.UTC);
    if (openAt.isBefore(now.plusSeconds(60))) {
      throw ApiException.validation("openAt 必须晚于当前时间 60 秒以上", "openAt");
    }
    if (openAt.isAfter(now.plusYears(10))) {
      throw ApiException.validation("openAt 不得超出当前时间 10 年", "openAt");
    }
    for (int i = 0; i < 5; i++) {
      String code = generateCode();
      if (capsules.existsByCode(code)) continue;
      CapsuleEntity capsule = new CapsuleEntity();
      capsule.setId(UUID.randomUUID().toString());
      capsule.setOwnerId(owner.getId());
      capsule.setCode(code);
      capsule.setTitle(req.title());
      capsule.setContent(req.content());
      capsule.setOpenAt(openAt);
      capsule.setInPlaza(req.inPlaza() == null || req.inPlaza());
      capsule.setFavoriteCount(0);
      capsule.setCreatedAt(now);
      capsule.setUpdatedAt(now);
      return mapper.detail(capsules.saveAndFlush(capsule), owner, owner.getId(), true);
    }
    throw new IllegalStateException("生成唯一码失败");
  }

  public CapsuleDetail getByCode(String code, String viewerId) {
    if (!code.matches("^[A-Za-z0-9]{8}$")) {
      throw ApiException.validation("code 必须为 8 位字母数字", "code");
    }
    CapsuleEntity capsule = capsules.findByCode(code.toUpperCase())
        .orElseThrow(() -> ApiException.notFound("胶囊不存在"));
    UserEntity owner = users.findById(capsule.getOwnerId())
        .orElseThrow(() -> ApiException.notFound("胶囊不存在"));
    return mapper.detail(capsule, owner, viewerId, true);
  }

  public CapsuleDetail getPlazaDetail(String id, String viewerId) {
    CapsuleEntity capsule = capsules.findById(id).filter(CapsuleEntity::isInPlaza)
        .orElseThrow(() -> ApiException.notFound("胶囊不存在"));
    UserEntity owner = users.findById(capsule.getOwnerId())
        .orElseThrow(() -> ApiException.notFound("胶囊不存在"));
    return mapper.detail(capsule, owner, viewerId, true);
  }

  @Transactional
  public void deleteOwn(UserEntity user, String id) {
    CapsuleEntity capsule = capsules.findById(id).orElseThrow(() -> ApiException.notFound("胶囊不存在"));
    if (!capsule.getOwnerId().equals(user.getId())) throw ApiException.forbidden("无权删除他人胶囊");
    favorites.deleteByIdCapsuleId(id);
    capsules.delete(capsule);
  }

  private String generateCode() {
    StringBuilder b = new StringBuilder(8);
    for (int i = 0; i < 8; i++) b.append(CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)]);
    return b.toString();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(ZoneOffset.UTC);
  }
}
