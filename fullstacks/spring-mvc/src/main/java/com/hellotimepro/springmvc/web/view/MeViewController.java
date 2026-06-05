package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.service.AvatarService;
import com.hellotimepro.springmvc.service.PlazaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/** 个人中心（受保护）：我创建的 / 我收藏的 / 账号设置。 */
@Controller
public class MeViewController {
  private final PlazaService plaza;
  private final AvatarService avatars;
  private final CookieAuthService cookieAuth;

  public MeViewController(PlazaService plaza, AvatarService avatars, CookieAuthService cookieAuth) {
    this.plaza = plaza;
    this.avatars = avatars;
    this.cookieAuth = cookieAuth;
  }

  @GetMapping("/me")
  public String me() {
    return "redirect:/me/created";
  }

  @GetMapping("/me/created")
  public String created(HttpServletRequest req, HttpServletResponse res, Model model) {
    Optional<UserEntity> u = cookieAuth.currentUser(req, res);
    if (u.isEmpty()) return "redirect:/login?from=/me/created";
    Paginated<?> result = plaza.myCapsules(u.get(), 1, 50);
    model.addAttribute("capsules", result.items());
    model.addAttribute("pagination", result.pagination());
    model.addAttribute("activeTab", "created");
    return "me-created";
  }

  @GetMapping("/me/favorites")
  public String favorites(HttpServletRequest req, HttpServletResponse res, Model model) {
    Optional<UserEntity> u = cookieAuth.currentUser(req, res);
    if (u.isEmpty()) return "redirect:/login?from=/me/favorites";
    Paginated<?> result = plaza.myFavorites(u.get(), 1, 50);
    model.addAttribute("capsules", result.items());
    model.addAttribute("pagination", result.pagination());
    model.addAttribute("activeTab", "favorites");
    return "me-favorites";
  }

  @GetMapping("/me/profile")
  public String profile(HttpServletRequest req, HttpServletResponse res, Model model) {
    if (cookieAuth.currentUser(req, res).isEmpty()) return "redirect:/login?from=/me/profile";
    model.addAttribute("avatars", avatars.list());
    model.addAttribute("activeTab", "profile");
    return "me-profile";
  }
}
