package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.dto.Dtos.UserOut;
import com.hellotimepro.springmvc.service.AvatarService;
import com.hellotimepro.springmvc.service.HealthStackService;
import com.hellotimepro.springmvc.service.MapperService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

/**
 * 给所有 SSR 视图统一注入登录态、导航高亮键、技术栈元数据与内置头像目录。
 * 仅作用于 {@code web.view} 包下的 {@code @Controller}，不影响 JSON 接口。
 */
@Component
@ControllerAdvice(basePackages = "com.hellotimepro.springmvc.web.view")
public class GlobalModelAttributes {
  private final CookieAuthService cookieAuth;
  private final MapperService mapper;
  private final HealthStackService healthStack;
  private final AvatarService avatars;

  public GlobalModelAttributes(CookieAuthService cookieAuth, MapperService mapper,
      HealthStackService healthStack, AvatarService avatars) {
    this.cookieAuth = cookieAuth;
    this.mapper = mapper;
    this.healthStack = healthStack;
    this.avatars = avatars;
  }

  @ModelAttribute
  public void inject(HttpServletRequest request, HttpServletResponse response, Model model) {
    populate(request, response, model, request.getRequestURI());
  }

  public void populate(HttpServletRequest request, HttpServletResponse response, Model model, String uri) {
    UserOut user = cookieAuth.currentUser(request, response).map(mapper::user).orElse(null);
    String path = uri == null ? "/" : uri;
    model.addAttribute("currentUser", user);
    model.addAttribute("authenticated", user != null);
    model.addAttribute("stackInfo", healthStack.stack());
    model.addAttribute("frontendStack", healthStack.frontendItems());
    model.addAttribute("frontendSummary", healthStack.frontendSummary());
    model.addAttribute("avatarMetas", avatars.metas());
    model.addAttribute("navKey", resolveNavKey(path));
    model.addAttribute("routeName", resolveRouteName(path));
    model.addAttribute("currentPath", path);
  }

  private static String resolveNavKey(String p) {
    if ("/".equals(p)) return "plaza";
    if (p.startsWith("/open") || p.startsWith("/capsules/") || p.startsWith("/c/")) return "open";
    if (p.startsWith("/create")) return "create";
    if (p.startsWith("/about")) return "about";
    if (p.startsWith("/me") || p.startsWith("/login") || p.startsWith("/register")) return "me";
    return "";
  }

  private static String resolveRouteName(String p) {
    if ("/".equals(p)) return "plaza";
    if (p.startsWith("/open")) return "open";
    if (p.startsWith("/capsules/") || p.startsWith("/c/")) return "capsule";
    if (p.startsWith("/create")) return "create";
    if (p.startsWith("/login")) return "login";
    if (p.startsWith("/register")) return "register";
    if (p.startsWith("/me")) return "me";
    if (p.startsWith("/about")) return "about";
    return "not-found";
  }
}
