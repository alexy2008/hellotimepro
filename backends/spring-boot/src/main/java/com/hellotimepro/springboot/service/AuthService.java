package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.domain.RefreshTokenEntity;
import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.AuthTokens;
import com.hellotimepro.springboot.dto.Dtos.ChangePasswordRequest;
import com.hellotimepro.springboot.dto.Dtos.LoginRequest;
import com.hellotimepro.springboot.dto.Dtos.RegisterRequest;
import com.hellotimepro.springboot.repository.RefreshTokenRepository;
import com.hellotimepro.springboot.repository.UserRepository;
import com.hellotimepro.springboot.web.ApiException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final AppProperties props;
  private final UserRepository users;
  private final RefreshTokenRepository refreshTokens;
  private final SecurityService security;
  private final MapperService mapper;
  private final AvatarService avatars;
  private final Map<String, Deque<Long>> failures = new ConcurrentHashMap<>();

  public AuthService(AppProperties props, UserRepository users, RefreshTokenRepository refreshTokens,
      SecurityService security, MapperService mapper, AvatarService avatars) {
    this.props = props;
    this.users = users;
    this.refreshTokens = refreshTokens;
    this.security = security;
    this.mapper = mapper;
    this.avatars = avatars;
  }

  @Transactional
  public AuthTokens register(RegisterRequest req) {
    if (!avatars.exists(req.avatarId())) throw ApiException.validation("头像 ID 不存在", "avatarId");
    String email = req.email().trim().toLowerCase();
    if (users.existsByEmail(email)) throw ApiException.conflict("邮箱已被注册", "email");
    if (users.existsByNickname(req.nickname())) throw ApiException.conflict("昵称已被使用", "nickname");

    OffsetDateTime now = now();
    UserEntity user = new UserEntity();
    user.setId(UUID.randomUUID().toString());
    user.setEmail(email);
    user.setPasswordHash(security.hashPassword(req.password()));
    user.setNickname(req.nickname());
    user.setAvatarId(req.avatarId());
    user.setCreatedAt(now);
    user.setUpdatedAt(now);
    try {
      users.saveAndFlush(user);
    } catch (DataIntegrityViolationException ex) {
      throw ApiException.conflict("注册冲突", null);
    }
    return issueTokenPair(user, null);
  }

  @Transactional
  public AuthTokens login(LoginRequest req) {
    String email = req.email().trim().toLowerCase();
    rateLimit(email);
    UserEntity user = users.findByEmail(email).orElse(null);
    if (user == null || !security.verifyPassword(req.password(), user.getPasswordHash())) {
      recordFailure(email);
      throw ApiException.unauthorized("邮箱或密码错误");
    }
    return issueTokenPair(user, null);
  }

  @Transactional(noRollbackFor = ApiException.class)
  public AuthTokens refresh(String rawRefresh) {
    String tokenHash = security.hashRefreshToken(rawRefresh);
    RefreshTokenEntity row = findRefreshTokenForRotation(tokenHash)
        .orElseThrow(() -> ApiException.unauthorized("refresh token 无效"));
    OffsetDateTime now = now();
    if (!row.getExpiresAt().isAfter(now)) throw ApiException.unauthorized("refresh token 已过期");
    if (row.getRevokedAt() != null) {
      refreshTokens.revokeFamily(row.getFamilyId(), now);
      throw ApiException.unauthorized("refresh token 已失效");
    }
    UserEntity user = users.findById(row.getUserId())
        .orElseThrow(() -> ApiException.unauthorized("用户不存在"));
    row.setRevokedAt(now);
    refreshTokens.save(row);
    return issueTokenPair(user, row.getFamilyId());
  }

  @Transactional
  public void logout(String rawRefresh) {
    if (rawRefresh == null || rawRefresh.isBlank()) return;
    refreshTokens.findByTokenHash(security.hashRefreshToken(rawRefresh)).ifPresent(row -> {
      if (row.getRevokedAt() == null) {
        row.setRevokedAt(now());
        refreshTokens.save(row);
      }
    });
  }

  @Transactional
  public void changePassword(UserEntity user, ChangePasswordRequest req) {
    if (!security.verifyPassword(req.currentPassword(), user.getPasswordHash())) {
      throw ApiException.unauthorized("当前密码错误");
    }
    user.setPasswordHash(security.hashPassword(req.newPassword()));
    user.setUpdatedAt(now());
    users.save(user);
    refreshTokens.revokeUser(user.getId(), now());
  }

  private AuthTokens issueTokenPair(UserEntity user, String familyId) {
    String access = security.createAccessToken(user);
    String refresh = security.generateRefreshToken();
    OffsetDateTime now = now();
    RefreshTokenEntity row = new RefreshTokenEntity();
    row.setId(UUID.randomUUID().toString());
    row.setUserId(user.getId());
    row.setTokenHash(security.hashRefreshToken(refresh));
    row.setFamilyId(familyId == null ? UUID.randomUUID().toString() : familyId);
    row.setExpiresAt(now.plusSeconds(props.getRefreshTokenTtlSeconds()));
    row.setCreatedAt(now);
    refreshTokens.save(row);
    return new AuthTokens(access, refresh, props.getAccessTokenTtlSeconds(),
        props.getRefreshTokenTtlSeconds(), mapper.user(user));
  }

  private java.util.Optional<RefreshTokenEntity> findRefreshTokenForRotation(String tokenHash) {
    if ("postgres".equals(props.getDbDriver())) {
      return refreshTokens.findByTokenHashForUpdate(tokenHash);
    }
    return refreshTokens.findByTokenHash(tokenHash);
  }

  private void rateLimit(String email) {
    Deque<Long> bucket = failures.computeIfAbsent(email, ignored -> new ArrayDeque<>());
    long now = System.nanoTime();
    synchronized (bucket) {
      while (!bucket.isEmpty() && (now - bucket.peekFirst()) > 60_000_000_000L) bucket.removeFirst();
      if (bucket.size() >= props.getLoginRateLimitPerMinute()) {
        throw ApiException.rateLimited("操作过于频繁，请稍后再试");
      }
    }
  }

  private void recordFailure(String email) {
    Deque<Long> bucket = failures.computeIfAbsent(email, ignored -> new ArrayDeque<>());
    synchronized (bucket) {
      bucket.addLast(System.nanoTime());
    }
  }

  private OffsetDateTime now() {
    return OffsetDateTime.now(ZoneOffset.UTC);
  }
}
