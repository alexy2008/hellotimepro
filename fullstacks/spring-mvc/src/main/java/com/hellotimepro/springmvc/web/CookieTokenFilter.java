package com.hellotimepro.springmvc.web;

import com.hellotimepro.springmvc.web.view.CookieAuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 让浏览器侧对 {@code /api/v1/*} 的 fetch 调用能用 httpOnly 的 access cookie 鉴权：
 * 当请求缺少 {@code Authorization} 头但带有 {@code ht_access} cookie 时，包装请求把它
 * 注入成 {@code Authorization: Bearer <access>}，复用既有 JSON 控制器的鉴权逻辑。
 *
 * <p>仅在 Authorization 头缺失时生效——契约黑盒测试发送真实 Bearer 头时此过滤器不介入，
 * 「无鉴权 → 401」用例也不受影响（既无头也无 cookie）。
 */
@Component
@Order(10)
public class CookieTokenFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain chain) throws ServletException, IOException {
    String existing = request.getHeader("Authorization");
    if ((existing == null || existing.isBlank()) && request.getRequestURI().startsWith("/api/v1/")) {
      String access = readCookie(request, CookieAuthService.ACCESS_COOKIE);
      if (access != null && !access.isBlank()) {
        request = new BearerHeaderRequest(request, "Bearer " + access);
      }
    }
    chain.doFilter(request, response);
  }

  private static String readCookie(HttpServletRequest req, String name) {
    Cookie[] cookies = req.getCookies();
    if (cookies == null) return null;
    for (Cookie c : cookies) {
      if (name.equals(c.getName())) return c.getValue();
    }
    return null;
  }

  /** 仅覆盖 Authorization 头的请求包装器。 */
  private static final class BearerHeaderRequest extends HttpServletRequestWrapper {
    private final String authorization;

    BearerHeaderRequest(HttpServletRequest request, String authorization) {
      super(request);
      this.authorization = authorization;
    }

    @Override
    public String getHeader(String name) {
      if ("Authorization".equalsIgnoreCase(name)) return authorization;
      return super.getHeader(name);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
      if ("Authorization".equalsIgnoreCase(name)) {
        return Collections.enumeration(List.of(authorization));
      }
      return super.getHeaders(name);
    }

    @Override
    public Enumeration<String> getHeaderNames() {
      List<String> names = Collections.list(super.getHeaderNames());
      if (names.stream().noneMatch("Authorization"::equalsIgnoreCase)) {
        names.add("Authorization");
      }
      return Collections.enumeration(names);
    }
  }
}
