package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.dto.Dtos.PlazaStats;
import com.hellotimepro.springmvc.service.CapsuleService;
import com.hellotimepro.springmvc.service.PlazaService;
import com.hellotimepro.springmvc.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

/** 公开页：广场（首页）、开启页、关于页、按 8 位码查看胶囊详情。 */
@Controller
public class PublicViewController {
  public record FeatureItem(String icon, String num, String title, String desc) {}
  public record TenetItem(String title, String htmlDesc) {}

  private static final List<FeatureItem> FEATURES = List.of(
      new FeatureItem("user", "01", "账号与头像", "邮箱注册即登录；十个内置头像，昵称全站唯一。"),
      new FeatureItem("pen", "02", "写一枚胶囊", "标题、正文、开启时间；没有头绪时，AI 给灵感，也能代笔。"),
      new FeatureItem("hourglass", "03", "倒计时与自动开启", "没到时间只显示倒计时；归零的那一刻，胶囊自己打开。"),
      new FeatureItem("globe", "04", "胶囊广场", "公开的胶囊陈列在这里，可搜索、筛选，按最新或最热排序。"),
      new FeatureItem("heart", "05", "收藏与「我的」", "收藏任何一枚胶囊，等它开启；在「我的」里管理写过的每一枚。"),
      new FeatureItem("sparkle", "06", "两套皮肤，昼夜两色", "「时笺」与「琥珀」随时切换，各有明暗两套主题，并记住你的选择。")
  );

  private static final List<TenetItem> TENETS = List.of(
      new TenetItem("规范即唯一事实源", "业务契约放在 <code class=\"mono\">spec/</code> 下：OpenAPI、数据库 schema、设计令牌。代码只是规范的投影，有歧义先改规范。"),
      new TenetItem("栈内地道", "Signals、组合式、Hooks、Runes、Compose……每个实现都用自己技术栈的惯用写法，而不是把同一份代码翻译十遍。"),
      new TenetItem("外部一致", "无论内部怎么写，对外的路由、JSON 形状、错误码与界面必须一致——肉眼可比，才谈得上对比。"),
      new TenetItem("黑盒验证", "契约用例与 UI 冒烟都从外部跑，不信任任何实现的自述；每个后端都要在 PostgreSQL 与 SQLite 上各过一遍。")
  );

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
    String safeSort = "hot".equals(sort) ? "hot" : "new";
    String safeFilter = ("opened".equals(filter) || "unopened".equals(filter)) ? filter : "all";
    int safePage = Math.max(1, page);
    String safeQ = clampQuery(q);

    String viewerId = viewerId(req, res);
    Paginated<CapsuleListItem> result = plaza.plazaList(safeSort, safeFilter, safeQ, safePage, 9, viewerId);
    PlazaStats stats = plaza.plazaStats(safeQ);
    PlazaStats overview = safeQ.isBlank() ? stats : plaza.plazaStats(null);
    Paginated<CapsuleListItem> featPage = plaza.plazaList("hot", "unopened", null, 1, 1, viewerId);
    CapsuleListItem featured = featPage.items().isEmpty() ? null : featPage.items().get(0);

    model.addAttribute("pageTitle", "把此刻寄给未来 · HelloTime Pro");
    model.addAttribute("capsules", result.items());
    model.addAttribute("pagination", result.pagination());
    model.addAttribute("stats", stats);
    model.addAttribute("overview", overview);
    model.addAttribute("featured", featured);
    model.addAttribute("sort", safeSort);
    model.addAttribute("filter", safeFilter);
    model.addAttribute("q", safeQ);
    return "plaza";
  }

  @GetMapping("/open")
  public String open(HttpServletRequest req, HttpServletResponse res, Model model) {
    Optional<UserEntity> user = cookieAuth.currentUser(req, res);
    List<CapsuleListItem> mySealed = user
        .map(u -> plaza.myCapsules(u, 1, 3).items())
        .orElse(List.of());
    model.addAttribute("pageTitle", "开启胶囊 · HelloTime Pro");
    model.addAttribute("mySealed", mySealed);
    return "open";
  }

  @GetMapping("/c/{code}")
  public String legacyCapsuleRedirect(@PathVariable String code) {
    return "redirect:/capsules/" + code;
  }

  @GetMapping("/capsules/{code}")
  public String capsuleByCode(@PathVariable String code,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    String viewerId = viewerId(req, res);
    model.addAttribute("code", code);
    try {
      CapsuleDetail detail = capsules.getByCode(code, viewerId);
      model.addAttribute("pageTitle", detail.title() + " · HelloTime Pro");
      model.addAttribute("capsule", detail);
      model.addAttribute("missing", false);
      model.addAttribute("reveal", false);
      return "capsule-detail";
    } catch (ApiException ex) {
      model.addAttribute("pageTitle", "查无此信 · HelloTime Pro");
      model.addAttribute("capsule", null);
      model.addAttribute("missing", true);
      return "capsule-detail";
    }
  }

  @GetMapping("/about")
  public String about(Model model) {
    model.addAttribute("pageTitle", "关于 · HelloTime Pro");
    model.addAttribute("features", FEATURES);
    model.addAttribute("tenets", TENETS);
    return "about";
  }

  private String viewerId(HttpServletRequest req, HttpServletResponse res) {
    return cookieAuth.currentUser(req, res).map(u -> u.getId().toString()).orElse(null);
  }

  static String clampQuery(String q) {
    if (q == null) return "";
    String t = q.strip();
    if (t.codePointCount(0, t.length()) <= 50) return t;
    return t.substring(0, t.offsetByCodePoints(0, 50));
  }
}
