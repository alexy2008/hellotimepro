package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.dto.Dtos.UserOut;
import com.hellotimepro.springmvc.service.MapperService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * 给所有 SSR 视图统一注入登录态：{@code currentUser}（未登录为 null）与 {@code authenticated}。
 * 头部 chip / 受保护页守卫据此渲染。仅作用于 {@code web.view} 包下的 @Controller，不影响 JSON 接口。
 */
@ControllerAdvice(basePackages = "com.hellotimepro.springmvc.web.view")
public class GlobalModelAttributes {
  private final CookieAuthService cookieAuth;
  private final MapperService mapper;

  public GlobalModelAttributes(CookieAuthService cookieAuth, MapperService mapper) {
    this.cookieAuth = cookieAuth;
    this.mapper = mapper;
  }

  @ModelAttribute
  public void inject(HttpServletRequest request, HttpServletResponse response,
      org.springframework.ui.Model model) {
    UserOut user = cookieAuth.currentUser(request, response).map(mapper::user).orElse(null);
    model.addAttribute("currentUser", user);
    model.addAttribute("authenticated", user != null);
  }
}
