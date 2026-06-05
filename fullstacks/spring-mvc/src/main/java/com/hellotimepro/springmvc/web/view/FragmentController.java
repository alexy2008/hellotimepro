package com.hellotimepro.springmvc.web.view;

import com.hellotimepro.springmvc.domain.CapsuleEntity;
import com.hellotimepro.springmvc.domain.FavoriteId;
import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.repository.CapsuleRepository;
import com.hellotimepro.springmvc.repository.FavoriteRepository;
import com.hellotimepro.springmvc.service.CapsuleService;
import com.hellotimepro.springmvc.service.FavoriteService;
import com.hellotimepro.springmvc.service.PlazaService;
import com.hellotimepro.springmvc.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * HTMX 片段端点（返回 HTML 片段而非整页）：广场网格搜索、收藏切换、撤回胶囊。
 * 鉴权走 SSR 的 cookie 会话（{@link CookieAuthService}）。
 */
@Controller
public class FragmentController {
  private final PlazaService plaza;
  private final FavoriteService favoriteService;
  private final CapsuleService capsuleService;
  private final FavoriteRepository favorites;
  private final CapsuleRepository capsules;
  private final CookieAuthService cookieAuth;

  public FragmentController(PlazaService plaza, FavoriteService favoriteService, CapsuleService capsuleService,
      FavoriteRepository favorites, CapsuleRepository capsules, CookieAuthService cookieAuth) {
    this.plaza = plaza;
    this.favoriteService = favoriteService;
    this.capsuleService = capsuleService;
    this.favorites = favorites;
    this.capsules = capsules;
    this.cookieAuth = cookieAuth;
  }

  /** 广场网格片段：搜索 / 排序 / 筛选 / 分页时由 HTMX 局部替换 #plaza-grid。 */
  @GetMapping("/ui/plaza/grid")
  public String plazaGrid(@RequestParam(defaultValue = "new") String sort,
      @RequestParam(defaultValue = "all") String filter,
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "1") int page,
      HttpServletRequest req, HttpServletResponse res, Model model) {
    String viewerId = cookieAuth.currentUser(req, res).map(u -> u.getId().toString()).orElse(null);
    Paginated<?> result = plaza.plazaList(sort, filter, q, page, 12, viewerId);
    model.addAttribute("capsules", result.items());
    model.addAttribute("pagination", result.pagination());
    return "fragments/plaza-grid :: grid";
  }

  /**
   * 收藏切换（由创建页/广场的 app.js 以 fetch(keepalive) 调用）：返回 JSON 新状态。
   * 匿名在浏览器侧已拦截并跳登录，这里仅作兜底返回 401。
   */
  @PostMapping("/ui/capsules/{id}/favorite-toggle")
  @ResponseBody
  public ResponseEntity<FavToggleResult> favoriteToggle(@PathVariable String id,
      HttpServletRequest req, HttpServletResponse res) {
    Optional<UserEntity> u = cookieAuth.currentUser(req, res);
    if (u.isEmpty()) return ResponseEntity.status(401).build();
    UserEntity user = u.get();
    UUID cid;
    try {
      cid = UUID.fromString(id);
    } catch (IllegalArgumentException ex) {
      throw ApiException.notFound("胶囊不存在");
    }
    boolean favorited;
    int count;
    if (favorites.existsById(new FavoriteId(user.getId(), cid))) {
      favoriteService.removeFavorite(user, id);
      favorited = false;
      count = capsules.findById(cid).map(CapsuleEntity::getFavoriteCount).orElse(0);
    } else {
      count = favoriteService.addFavorite(user, id).favoriteCount();
      favorited = true;
    }
    return ResponseEntity.ok(new FavToggleResult(favorited, count));
  }

  public record FavToggleResult(boolean favorited, int favoriteCount) {}

  /** 撤回（删除）自己的胶囊：HTMX 删除对应卡片。 */
  @DeleteMapping("/ui/capsules/{id}")
  public ResponseEntity<String> deleteOwn(@PathVariable String id,
      HttpServletRequest req, HttpServletResponse res) {
    Optional<UserEntity> u = cookieAuth.currentUser(req, res);
    if (u.isEmpty()) {
      res.setHeader("HX-Redirect", "/login?from=/me/created");
      return ResponseEntity.ok().build();
    }
    capsuleService.deleteOwn(u.get(), id);
    return ResponseEntity.ok("");
  }
}
