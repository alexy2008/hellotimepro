package com.hellotimepro.springboot.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.exceptions.TokenExpiredException;
import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.domain.UserEntity;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Optional;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class SecurityService {
  private final AppProperties props;
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);
  private final Algorithm algorithm;
  private final JWTVerifier verifier;

  public SecurityService(AppProperties props) {
    this.props = props;
    this.algorithm = Algorithm.HMAC256(props.getJwtSecret());
    this.verifier = JWT.require(algorithm).build();
  }

  public String hashPassword(String plain) {
    return encoder.encode(plain);
  }

  public boolean verifyPassword(String plain, String hashed) {
    return encoder.matches(plain, hashed);
  }

  public String createAccessToken(UserEntity user) {
    Instant now = Instant.now();
    Instant exp = now.plusSeconds(props.getAccessTokenTtlSeconds());
    return JWT.create()
        .withSubject(user.getId())
        .withClaim("nickname", user.getNickname())
        .withClaim("avatarId", user.getAvatarId())
        .withIssuedAt(Date.from(now))
        .withExpiresAt(Date.from(exp))
        .sign(algorithm);
  }

  public DecodeResult decodeAccessToken(String token) {
    try {
      return new DecodeResult(Optional.of(verifier.verify(token).getSubject()), null);
    } catch (TokenExpiredException ex) {
      return new DecodeResult(Optional.empty(), "access_token_expired");
    } catch (JWTVerificationException ex) {
      return new DecodeResult(Optional.empty(), "invalid_token");
    }
  }

  public String generateRefreshToken() {
    byte[] raw = new byte[32];
    SecureRandomHolder.INSTANCE.nextBytes(raw);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
  }

  public String hashRefreshToken(String raw) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
      StringBuilder out = new StringBuilder(hash.length * 2);
      for (byte b : hash) {
        out.append(String.format("%02x", b));
      }
      return out.toString();
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  public record DecodeResult(Optional<String> subject, String error) {}

  private static final class SecureRandomHolder {
    private static final java.security.SecureRandom INSTANCE = new java.security.SecureRandom();
  }
}
