package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.dto.Dtos.AuthTokens;
import com.hellotimepro.springmvc.dto.Dtos.LoginRequest;
import com.hellotimepro.springmvc.dto.Dtos.RegisterRequest;
import com.hellotimepro.springmvc.service.AuthService;
import com.hellotimepro.springmvc.service.AvatarService;
import com.hellotimepro.springmvc.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** 鉴权 SSR：登录 / 注册 / 登出，成功后写 httpOnly cookie 并重定向。 */
@Controller
public class AuthViewController {
  private final AuthService auth;
  private final AvatarService avatars;
  private final CookieAuthService cookieAuth;

  public AuthViewController(AuthService auth, AvatarService avatars, CookieAuthService cookieAuth) {
    this.auth = auth;
    this.avatars = avatars;
    this.cookieAuth = cookieAuth;
  }

  @GetMapping("/login")
  public String loginPage(@RequestParam(required = false) String from, Model model) {
    model.addAttribute("from", from == null ? "" : from);
    return "login";
  }

  @PostMapping("/login")
  public String login(@RequestParam String email, @RequestParam String password,
      @RequestParam(required = false) String from, HttpServletResponse res, Model model) {
    try {
      AuthTokens tokens = auth.login(new LoginRequest(email.trim(), password));
      cookieAuth.setAuthCookies(res, tokens);
      return "redirect:" + safeNext(from, "/me/created");
    } catch (ApiException ex) {
      model.addAttribute("error", ex.getMessage());
      model.addAttribute("from", from == null ? "" : from);
      model.addAttribute("email", email);
      return "login";
    }
  }

  @GetMapping("/register")
  public String registerPage(Model model) {
    model.addAttribute("avatars", avatars.list());
    return "register";
  }

  @PostMapping("/register")
  public String register(@RequestParam String email, @RequestParam String nickname,
      @RequestParam String password, @RequestParam(required = false) String avatarId,
      HttpServletResponse res, Model model) {
    try {
      AuthTokens tokens = auth.register(new RegisterRequest(email.trim(), password, nickname.trim(),
          avatarId == null ? "" : avatarId));
      cookieAuth.setAuthCookies(res, tokens);
      return "redirect:/create";
    } catch (ApiException ex) {
      model.addAttribute("error", ex.getMessage());
      model.addAttribute("avatars", avatars.list());
      model.addAttribute("email", email);
      model.addAttribute("nickname", nickname);
      model.addAttribute("selectedAvatar", avatarId);
      return "register";
    }
  }

  @PostMapping("/logout")
  public String logout(HttpServletRequest req, HttpServletResponse res) {
    auth.logout(cookieAuth.readRefresh(req));
    cookieAuth.clearAuthCookies(res);
    return "redirect:/";
  }

  /** 仅允许站内相对路径回跳，拒绝 //evil、/\evil、http(s):// 等跨域跳转。 */
  private String safeNext(String next, String fallback) {
    if (next == null || next.isBlank()) return fallback;
    if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
    return next;
  }
}
