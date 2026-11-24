package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.dto.Dtos.PlazaStats;
import com.hellotimepro.springmvc.service.CapsuleService;
import com.hellotimepro.springmvc.service.PlazaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.hellotimepro.springmvc.web.ApiException;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

/**
 * HTMX 与局部 HTML 片段端点：
 * <ul>
 *   <li>{@code GET /ui/plaza/grid}：广场搜索 / 筛选 / 排序 / 分页的 HTML 片段替换</li>
 *   <li>{@code GET /ui/plaza/overview}：广场概览年鉴片段刷新</li>
 *   <li>{@code GET /ui/capsules/{code}/opened}：详情页倒计时归零、服务端确认已开启后的信笺片段</li>
 *   <li>{@code GET /ui/me/{kind}/rows}：「我的」列表分页追加的双皮肤条目片段</li>
 * </ul>
 */
@Controller
public class FragmentController {
  private final PlazaService plaza;
  private final CapsuleService capsules;
  private final CookieAuthService cookieAuth;

  public FragmentController(PlazaService plaza, CapsuleService capsules, CookieAuthService cookieAuth) {
    this.plaza = plaza;
    this.capsules = capsules;
    this.cookieAuth = cookieAuth;
  }

  /**
   * 片段端点里的业务异常按其状态码返回（如胶囊已被删除 → 404），
   * 否则会落到容器变成 500，详情页的启封轮询就认不出 404、无限重试。
   */
  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Void> apiError(ApiException ex) {
    return ResponseEntity.status(ex.getStatus()).build();
  }

  @GetMapping("/ui/plaza/grid")
  public String plazaGrid(@RequestParam(defaultValue = "new") String sort,
      @RequestParam(defaultValue = "all") String filter,
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "1") int page,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    String safeSort = "hot".equals(sort) ? "hot" : "new";
    String safeFilter = ("opened".equals(filter) || "unopened".equals(filter)) ? filter : "all";
    int safePage = Math.max(1, page);
    String safeQ = PublicViewController.clampQuery(q);

    String viewerId = cookieAuth.currentUser(req, res).map(u -> u.getId().toString()).orElse(null);
    Paginated<CapsuleListItem> result = plaza.plazaList(safeSort, safeFilter, safeQ, safePage, 9, viewerId);
    PlazaStats stats = plaza.plazaStats(safeQ);

    model.addAttribute("capsules", result.items());
    model.addAttribute("pagination", result.pagination());
    model.addAttribute("stats", stats);
    model.addAttribute("sort", safeSort);
    model.addAttribute("filter", safeFilter);
    model.addAttribute("q", safeQ);
    return "fragments/plaza-grid :: results";
  }

  @GetMapping("/ui/plaza/overview")
  public String plazaOverview(Model model) {
    model.addAttribute("overview", plaza.plazaStats(null));
    return "fragments/plaza-grid :: overview";
  }

  @GetMapping("/ui/capsules/{code}/opened")
  public String openedCapsule(@PathVariable String code,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    String viewerId = cookieAuth.currentUser(req, res).map(u -> u.getId().toString()).orElse(null);
    CapsuleDetail detail = capsules.getByCode(code, viewerId);
    if (!detail.isOpened()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "not_opened_yet");
    }
    model.addAttribute("capsule", detail);
    model.addAttribute("reveal", true);
    return "fragments/capsule-detail :: openedBoth";
  }

  @GetMapping("/ui/me/{kind}/rows")
  public String meRows(@PathVariable String kind,
      @RequestParam(defaultValue = "1") int page,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    Optional<UserEntity> u = cookieAuth.currentUser(req, res);
    if (u.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized");
    }
    int safePage = Math.max(1, page);
    if ("created".equals(kind)) {
      Paginated<CapsuleListItem> result = plaza.myCapsules(u.get(), safePage, MeViewController.PAGE_SIZE);
      res.setHeader("X-Total-Count", String.valueOf(result.pagination().total()));
      model.addAttribute("items", result.items());
      return "fragments/me-rows :: createdBoth";
    }
    if ("favorites".equals(kind)) {
      Paginated<CapsuleListItem> result = plaza.myFavorites(u.get(), safePage, MeViewController.PAGE_SIZE);
      res.setHeader("X-Total-Count", String.valueOf(result.pagination().total()));
      model.addAttribute("items", result.items());
      return "fragments/me-rows :: favoritesBoth";
    }
    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown_kind");
  }
}
