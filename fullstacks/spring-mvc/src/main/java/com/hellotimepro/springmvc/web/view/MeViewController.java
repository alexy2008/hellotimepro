package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springmvc.dto.Dtos.MyStats;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.service.PlazaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/** 个人中心（受保护）：我创建的 / 我收藏的 / 账号设置。 */
@Controller
public class MeViewController {
  public static final int PAGE_SIZE = 20;

  private final PlazaService plaza;
  private final CookieAuthService cookieAuth;

  public MeViewController(PlazaService plaza, CookieAuthService cookieAuth) {
    this.plaza = plaza;
    this.cookieAuth = cookieAuth;
  }

  @GetMapping("/me")
  public String meRoot(HttpServletRequest req, HttpServletResponse res) {
    if (cookieAuth.currentUser(req, res).isEmpty()) {
      return "redirect:/login?redirect=%2Fme%2Fcreated";
    }
    return "redirect:/me/created";
  }

  @GetMapping("/me/{tab}")
  public String meTab(@PathVariable String tab, HttpServletRequest req, HttpServletResponse res, Model model) {
    if (!"created".equals(tab) && !"favorites".equals(tab) && !"profile".equals(tab)) {
      return "redirect:/me/created";
    }
    Optional<UserEntity> u = cookieAuth.currentUser(req, res);
    if (u.isEmpty()) {
      String encoded = URLEncoder.encode("/me/" + tab, StandardCharsets.UTF_8);
      return "redirect:/login?redirect=" + encoded;
    }

    UserEntity user = u.get();
    MyStats stats = plaza.myStats(user);
    model.addAttribute("pageTitle", "我的 · HelloTime Pro");
    model.addAttribute("tab", tab);
    model.addAttribute("myStats", stats);
    model.addAttribute("pageSize", PAGE_SIZE);

    if ("created".equals(tab)) {
      Paginated<CapsuleListItem> result = plaza.myCapsules(user, 1, PAGE_SIZE);
      model.addAttribute("items", result.items());
      model.addAttribute("pagination", result.pagination());
    } else if ("favorites".equals(tab)) {
      Paginated<CapsuleListItem> result = plaza.myFavorites(user, 1, PAGE_SIZE);
      model.addAttribute("items", result.items());
      model.addAttribute("pagination", result.pagination());
    } else {
      model.addAttribute("items", List.of());
      model.addAttribute("pagination", null);
    }

    return "me";
  }
}
