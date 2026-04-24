package com.hellotimepro.springboot.service;

import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.repository.UserRepository;
import com.hellotimepro.springboot.web.ApiException;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class AuthContext {
  private final SecurityService security;
  private final UserRepository users;

  public AuthContext(SecurityService security, UserRepository users) {
    this.security = security;
    this.users = users;
  }

  public Optional<UserEntity> optional(String authorization) {
    String token = parseBearer(authorization);
    if (token == null) return Optional.empty();
    SecurityService.DecodeResult decoded = security.decodeAccessToken(token);
    return decoded.subject().flatMap(users::findById);
  }

  public UserEntity required(String authorization) {
    String token = parseBearer(authorization);
    if (token == null) throw ApiException.unauthorized("缺少 access token");
    SecurityService.DecodeResult decoded = security.decodeAccessToken(token);
    if (decoded.subject().isEmpty()) throw ApiException.unauthorized(decoded.error());
    return users.findById(decoded.subject().get()).orElseThrow(() -> ApiException.unauthorized("用户不存在"));
  }

  private String parseBearer(String authorization) {
    if (authorization == null || authorization.isBlank()) return null;
    String[] parts = authorization.trim().split("\\s+", 2);
    if (parts.length != 2 || !"bearer".equalsIgnoreCase(parts[0])) return null;
    return parts[1].trim();
  }
}
