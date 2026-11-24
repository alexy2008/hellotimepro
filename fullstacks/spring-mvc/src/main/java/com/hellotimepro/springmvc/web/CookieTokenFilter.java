package com.hellotimepro.springmvc.web;

import com.hellotimepro.springmvc.web.view.CookieAuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
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
 * 让浏览器侧对 {@code /api/v1/*} 的 fetch 调用能用 httpOnly cookie 鉴权：
 * 当请求缺少 {@code Authorization} 头但带有会话 cookie 时，包装请求注入 {@code Authorization: Bearer <access>}。
 *
 * <p>仅在 Authorization 头缺失时生效——契约黑盒测试发送真实 Bearer 头或无 cookie 时此过滤器不介入。
 */
@Component
@Order(10)
public class CookieTokenFilter extends OncePerRequestFilter {
  private final CookieAuthService cookieAuth;

  public CookieTokenFilter(CookieAuthService cookieAuth) {
    this.cookieAuth = cookieAuth;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain chain) throws ServletException, IOException {
    String uri = request.getRequestURI();
    String existing = request.getHeader("Authorization");
    if ((existing == null || existing.isBlank())
        && uri.startsWith("/api/v1/")
        && !uri.startsWith("/api/v1/auth/")) {
      String access = cookieAuth.resolveAccessForApi(request, response);
      if (access != null && !access.isBlank()) {
        request = new BearerHeaderRequest(request, "Bearer " + access);
      }
    }
    chain.doFilter(request, response);
  }

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
