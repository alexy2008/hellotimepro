package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.config.AppProperties;
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
import org.springframework.stereotype.Service;

/**
 * 服务端渲染（SSR）这一侧用 httpOnly cookie 承载会话：access JWT 与 refresh token。
 *
 * <p>JSON 接口（/api/v1/*）仍然走标准的 Bearer 头鉴权——浏览器侧的 fetch 调用由
 * {@link com.hellotimepro.springmvc.web.CookieTokenFilter} 把 access cookie 注入成
 * Authorization 头，从而复用同一套 {@code AuthContext} 控制器逻辑，无需为 UI 另开接口。
 *
 * <p>登录态优先用自包含的 access JWT 解码（1 小时有效），仅当 access 缺失/过期时才用
 * refresh cookie 轮换一次——避免每次导航都轮换 refresh token（参考 next/nuxt 全栈
 * 「急切刷新导致整页 reload 误登出」的坑）。
 */
@Service
public class CookieAuthService {
  public static final String ACCESS_COOKIE = "ht_access";
  public static final String REFRESH_COOKIE = "ht_refresh";

  private final SecurityService security;
  private final UserRepository users;
  private final AuthService auth;
  private final AppProperties props;

  public CookieAuthService(SecurityService security, UserRepository users, AuthService auth,
      AppProperties props) {
    this.security = security;
    this.users = users;
    this.auth = auth;
    this.props = props;
  }

  /** 解析当前登录用户：先用 access cookie 解码；过期时用 refresh cookie 轮换并写回新 cookie。 */
  public Optional<UserEntity> currentUser(HttpServletRequest req, HttpServletResponse res) {
    String access = readCookie(req, ACCESS_COOKIE);
    if (access != null && !access.isBlank()) {
      SecurityService.DecodeResult decoded = security.decodeAccessToken(access);
      if (decoded.subject().isPresent()) {
        Optional<UserEntity> user = users.findById(UUID.fromString(decoded.subject().get()));
        if (user.isPresent()) return user;
      }
    }
    // access 缺失/过期/无效 → 尝试用 refresh 轮换一次
    String refresh = readCookie(req, REFRESH_COOKIE);
    if (refresh != null && !refresh.isBlank() && res != null) {
      try {
        AuthTokens tokens = auth.refresh(refresh);
        setAuthCookies(res, tokens);
        return users.findById(UUID.fromString(tokens.user().id()));
      } catch (RuntimeException ex) {
        clearAuthCookies(res);
      }
    }
    return Optional.empty();
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
    // SameSite=Lax 足够：同源 SSR + fetch；教学项目不强制 Secure（本地 http）。
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
