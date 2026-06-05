package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.dto.Dtos.StackItem;
import com.hellotimepro.springmvc.service.CapsuleService;
import com.hellotimepro.springmvc.service.PlazaService;
import com.hellotimepro.springmvc.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Optional;
import org.springframework.boot.SpringBootVersion;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/** 公开页：广场（首页）、开启页、关于页、按 8 位码查看胶囊详情。 */
@Controller
public class PublicViewController {
  private final PlazaService plaza;
  private final CapsuleService capsules;
  private final CookieAuthService cookieAuth;

  public PublicViewController(PlazaService plaza, CapsuleService capsules, CookieAuthService cookieAuth) {
    this.plaza = plaza;
    this.capsules = capsules;
    this.cookieAuth = cookieAuth;
  }

  @GetMapping("/")
  public String plaza(@RequestParam(defaultValue = "new") String sort,
      @RequestParam(defaultValue = "all") String filter,
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "1") int page,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    String viewerId = viewerId(req, res);
    Paginated<?> result = plaza.plazaList(sort, filter, q, page, 12, viewerId);
    model.addAttribute("capsules", result.items());
    model.addAttribute("pagination", result.pagination());
    model.addAttribute("sort", sort);
    model.addAttribute("filter", filter);
    model.addAttribute("q", q == null ? "" : q);
    return "plaza";
  }

  @GetMapping("/open")
  public String open() {
    return "open";
  }

  @GetMapping("/about")
  public String about(Model model) {
    model.addAttribute("frontendStack", List.of(
        new StackItem("framework", "Thymeleaf", "3", null),
        new StackItem("enhancement", "HTMX", "2", null),
        new StackItem("styling", "Tailwind CSS", "4", "/static/icons/tailwindcss.svg")));
    model.addAttribute("frontendSummary",
        "基于 Spring MVC + Thymeleaf 服务端渲染：页面由服务器拼装 HTML 直接返回，" +
        "首屏即完整内容、对 SEO 与无脚本环境友好。HTMX 以声明式属性按需发起局部请求，" +
        "用返回的 HTML 片段做精细替换（广场搜索、收藏切换），在不写 SPA 的前提下获得局部刷新体验；" +
        "少量纯浏览器行为（头像选择、8 位码输入、AI 灵感、表单校验）用渐进增强的轻量原生 JS 实现。" +
        "Tailwind CSS v4 配合设计令牌（Design Tokens）统一视觉，与其它前端共享同一套 cy-* 组件类。");
    model.addAttribute("backendStack", List.of(
        new StackItem("language", "Java", String.valueOf(Runtime.version().feature()), "/static/icons/java.svg"),
        new StackItem("framework", "Spring Boot", SpringBootVersion.getVersion(), "/static/icons/springboot.svg"),
        new StackItem("orm", "Hibernate", "6", "/static/icons/hibernate.svg")));
    model.addAttribute("backendSummary",
        "与独立的 Spring Boot 后端实现同源：Spring Data JPA + Hibernate 承载领域模型，" +
        "针对 PostgreSQL / SQLite 的 UUID 与时间戳差异自制跨库 JdbcType 运行时按方言分流，" +
        "JWT（HS256）+ refresh token 轮换与族吊销实现鉴权。SSR 这一侧用 httpOnly cookie 承载会话，" +
        "同时仍对外暴露完整的 /api/v1 JSON 契约（与纯后端实现逐字一致）。");
    return "about";
  }

  @GetMapping("/c/{code}")
  public String capsuleByCode(@PathVariable String code,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    String viewerId = viewerId(req, res);
    try {
      CapsuleDetail detail = capsules.getByCode(code, viewerId);
      model.addAttribute("capsule", detail);
      model.addAttribute("countdown", null);
      return "capsule-detail";
    } catch (ApiException ex) {
      model.addAttribute("error", ex.getMessage());
      return "capsule-detail";
    }
  }

  private String viewerId(HttpServletRequest req, HttpServletResponse res) {
    Optional<UserEntity> user = cookieAuth.currentUser(req, res);
    return user.map(u -> u.getId().toString()).orElse(null);
  }
}
