package com.hellotimepro.springmvc.web.view;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/** 创建胶囊页（受保护）：未登录重定向至 /login?redirect=%2Fcreate。 */
@Controller
public class CreateViewController {
  private final CookieAuthService cookieAuth;

  public CreateViewController(CookieAuthService cookieAuth) {
    this.cookieAuth = cookieAuth;
  }

  @GetMapping("/create")
  public String createPage(HttpServletRequest req, HttpServletResponse res, Model model) {
    if (cookieAuth.currentUser(req, res).isEmpty()) {
      return "redirect:/login?redirect=%2Fcreate";
    }
    model.addAttribute("pageTitle", "写给未来 · HelloTime Pro");
    return "create";
  }
}
