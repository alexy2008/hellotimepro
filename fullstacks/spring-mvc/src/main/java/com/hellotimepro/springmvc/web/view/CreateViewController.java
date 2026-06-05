package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springmvc.dto.Dtos.CreateCapsuleRequest;
import com.hellotimepro.springmvc.service.CapsuleService;
import com.hellotimepro.springmvc.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** 创建胶囊页（受保护）。表单提交走 SSR；AI 灵感/生成由 create 页的原生 JS 直接调 JSON 接口。 */
@Controller
public class CreateViewController {
  private final CapsuleService capsules;
  private final CookieAuthService cookieAuth;

  public CreateViewController(CapsuleService capsules, CookieAuthService cookieAuth) {
    this.capsules = capsules;
    this.cookieAuth = cookieAuth;
  }

  @GetMapping("/create")
  public String createPage(HttpServletRequest req, HttpServletResponse res) {
    if (cookieAuth.currentUser(req, res).isEmpty()) return "redirect:/login?from=/create";
    return "create";
  }

  @PostMapping("/create")
  public String create(@RequestParam String title, @RequestParam String content,
      @RequestParam String openAt, @RequestParam(defaultValue = "false") boolean inPlaza,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    Optional<UserEntity> u = cookieAuth.currentUser(req, res);
    if (u.isEmpty()) return "redirect:/login?from=/create";
    try {
      OffsetDateTime open = OffsetDateTime.parse(openAt);
      CapsuleDetail created = capsules.create(u.get(),
          new CreateCapsuleRequest(title, content, open, inPlaza));
      return "redirect:/c/" + created.code();
    } catch (DateTimeParseException ex) {
      return renderError(model, "开启时间格式不正确", title, content, inPlaza);
    } catch (ApiException ex) {
      return renderError(model, ex.getMessage(), title, content, inPlaza);
    }
  }

  private String renderError(Model model, String error, String title, String content, boolean inPlaza) {
    model.addAttribute("error", error);
    model.addAttribute("title", title);
    model.addAttribute("content", content);
    model.addAttribute("inPlaza", inPlaza);
    return "create";
  }
}
