package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** 鉴权 SSR 视图：登录 / 注册 / 登出；已登录访问登录或注册页时自动跳回站内且不破坏当前会话。 */
@Controller
public class AuthViewController {
  private final AuthService auth;
  private final CookieAuthService cookieAuth;

  public AuthViewController(AuthService auth, CookieAuthService cookieAuth) {
    this.auth = auth;
    this.cookieAuth = cookieAuth;
  }

  @GetMapping("/login")
  public String loginPage(@RequestParam(required = false) String redirect,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    if (cookieAuth.currentUser(req, res).isPresent()) {
      return "redirect:" + safeRedirect(redirect, "/");
    }
    model.addAttribute("pageTitle", "登录 · HelloTime Pro");
    model.addAttribute("redirect", redirect == null ? "" : redirect);
    return "login";
  }

  @GetMapping("/register")
  public String registerPage(@RequestParam(required = false) String redirect,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    if (cookieAuth.currentUser(req, res).isPresent()) {
      return "redirect:" + safeRedirect(redirect, "/");
    }
    model.addAttribute("pageTitle", "注册 · HelloTime Pro");
    model.addAttribute("redirect", redirect == null ? "" : redirect);
    return "register";
  }

  @PostMapping("/logout")
  public String logout(HttpServletRequest req, HttpServletResponse res) {
    auth.logout(cookieAuth.readRefresh(req));
    cookieAuth.clearAuthCookies(res);
    return "redirect:/";
  }

  /** 仅允许站内相对路径回跳，拒绝 //evil、/\evil、http(s):// 等外站跳转。 */
  public static String safeRedirect(String next, String fallback) {
    if (next == null || next.isBlank()) return fallback;
    if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
    return next;
  }
}
