package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.AuthTokens;
import com.hellotimepro.springmvc.repository.UserRepository;
import com.hellotimepro.springmvc.service.AuthService;
import com.hellotimepro.springmvc.service.SecurityService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * 服务端渲染（SSR）侧用 httpOnly cookie 承载会话：access JWT 与 refresh token。
 *
 * <p>同一请求内通过 request attribute 缓存解析结果，避免 {@code GlobalModelAttributes} 与
 * 页面 {@code @Controller} 两次调用在 access 刚过期时重复轮换 refresh token 触发重用检测。
 */
@Service
public class CookieAuthService {
  public static final String ACCESS_COOKIE = "ht_access";
  public static final String REFRESH_COOKIE = "ht_refresh";
  private static final String REQ_USER_ATTR = "ht.resolved.user";
  private static final String REQ_ACCESS_ATTR = "ht.resolved.access";
  private static final long ROTATION_GRACE_MS = 10_000;

  private record Rotation(CompletableFuture<AuthTokens> future, long startedAt) {}

  private final ConcurrentHashMap<String, Rotation> rotations = new ConcurrentHashMap<>();
  private final SecurityService security;
  private final UserRepository users;
  private final AuthService auth;

  public CookieAuthService(SecurityService security, UserRepository users, AuthService auth) {
    this.security = security;
    this.users = users;
    this.auth = auth;
  }

  /** 解析当前登录用户：先用 access cookie 解码；过期时用 refresh cookie 轮换一次并写回新 cookie。 */
  @SuppressWarnings("unchecked")
  public Optional<UserEntity> currentUser(HttpServletRequest req, HttpServletResponse res) {
    Object cached = req.getAttribute(REQ_USER_ATTR);
    if (cached instanceof Optional<?> opt) {
      return (Optional<UserEntity>) opt;
    }

    Optional<UserEntity> resolved = Optional.empty();
    String access = readCookie(req, ACCESS_COOKIE);
    if (access != null && !access.isBlank()) {
      SecurityService.DecodeResult decoded = security.decodeAccessToken(access);
      if (decoded.subject().isPresent()) {
        try {
          resolved = users.findById(UUID.fromString(decoded.subject().get()));
          if (resolved.isPresent()) {
            req.setAttribute(REQ_ACCESS_ATTR, access);
            req.setAttribute(REQ_USER_ATTR, resolved);
            return resolved;
          }
        } catch (IllegalArgumentException ignored) {
          // ignore malformed subject
        }
      }
    }

    String refresh = readCookie(req, REFRESH_COOKIE);
    if (refresh != null && !refresh.isBlank() && res != null) {
      try {
        AuthTokens tokens = rotateOnce(refresh);
        setAuthCookies(res, tokens);
        req.setAttribute(REQ_ACCESS_ATTR, tokens.accessToken());
        resolved = users.findById(UUID.fromString(tokens.user().id()));
      } catch (RuntimeException ex) {
        clearAuthCookies(res);
      }
    }

    req.setAttribute(REQ_USER_ATTR, resolved);
    return resolved;
  }

  /**
   * 供 {@link com.hellotimepro.springmvc.web.CookieTokenFilter} 将浏览器 cookie 桥接为 Bearer 头。
   * 当 access 有效时直接返回；当 access 过期但存在有效 refresh cookie 时透明轮换一次。
   */
  public String resolveAccessForApi(HttpServletRequest req, HttpServletResponse res) {
    String access = readCookie(req, ACCESS_COOKIE);
    if (access != null && !access.isBlank()) {
      SecurityService.DecodeResult decoded = security.decodeAccessToken(access);
      if (decoded.subject().isPresent()) {
        return access;
      }
    }
    String refresh = readCookie(req, REFRESH_COOKIE);
    if (refresh != null && !refresh.isBlank() && res != null) {
      try {
        AuthTokens tokens = rotateOnce(refresh);
        setAuthCookies(res, tokens);
        return tokens.accessToken();
      } catch (RuntimeException ex) {
        clearAuthCookies(res);
      }
    }
    return access;
  }

  /**
   * 同一个 refresh cookie 只轮换一次：并发请求（多标签页同时恢复、连点收藏）共用第一次轮换的结果。
   *
   * <p>request attribute 只能管住同一请求内部；跨请求时第二个请求若再拿旧 refresh 调
   * {@link AuthService#refresh}，会被当成重放而吊销整个令牌家族。这里按 refresh 哈希做进程内单飞，
   * 结果（成功或失败）保留 {@link #ROTATION_GRACE_MS}，覆盖浏览器拿到新 cookie 之前发出的请求。
   */
  private AuthTokens rotateOnce(String refresh) {
    long now = System.currentTimeMillis();
    rotations.entrySet().removeIf(e -> e.getValue().future().isDone()
        && now - e.getValue().startedAt() > ROTATION_GRACE_MS);

    String key = security.hashRefreshToken(refresh);
    Rotation fresh = new Rotation(new CompletableFuture<>(), now);
    Rotation current = rotations.compute(key, (k, old) ->
        old != null && (!old.future().isDone() || now - old.startedAt() <= ROTATION_GRACE_MS) ? old : fresh);

    if (current == fresh) {
      try {
        AuthTokens tokens = auth.refresh(refresh);
        fresh.future().complete(tokens);
      } catch (RuntimeException ex) {
        fresh.future().completeExceptionally(ex);
      }
    }
    try {
      return current.future().join();
    } catch (CompletionException ex) {
      if (ex.getCause() instanceof RuntimeException cause) throw cause;
      throw ex;
    }
  }

  public void setAuthCookies(HttpServletResponse res, AuthTokens tokens) {
    res.addHeader("Set-Cookie", buildCookie(ACCESS_COOKIE, tokens.accessToken(), tokens.accessTokenExpiresIn()));
    res.addHeader("Set-Cookie", buildCookie(REFRESH_COOKIE, tokens.refreshToken(), tokens.refreshTokenExpiresIn()));
  }

  public void clearAuthCookies(HttpServletResponse res) {
    res.addHeader("Set-Cookie", buildCookie(ACCESS_COOKIE, "", 0));
    res.addHeader("Set-Cookie", buildCookie(REFRESH_COOKIE, "", 0));
  }

  public String readRefresh(HttpServletRequest req) {
    return readCookie(req, REFRESH_COOKIE);
  }

  private String buildCookie(String name, String value, int maxAgeSeconds) {
    return name + "=" + value + "; Path=/; Max-Age=" + maxAgeSeconds + "; HttpOnly; SameSite=Lax";
  }

  private String readCookie(HttpServletRequest req, String name) {
    Cookie[] cookies = req.getCookies();
    if (cookies == null) return null;
    for (Cookie c : cookies) {
      if (name.equals(c.getName())) return c.getValue();
    }
    return null;
  }
}
