package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.dto.Dtos.FavoriteRequest;
import com.hellotimepro.springboot.dto.Dtos.FavoriteResult;
import com.hellotimepro.springboot.dto.Dtos.Paginated;
import com.hellotimepro.springboot.service.AuthContext;
import com.hellotimepro.springboot.service.FavoriteService;
import com.hellotimepro.springboot.service.PlazaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/favorites")
public class FavoriteController {
  private final AuthContext auth;
  private final FavoriteService favorites;
  private final PlazaService plaza;

  public FavoriteController(AuthContext auth, FavoriteService favorites, PlazaService plaza) {
    this.auth = auth;
    this.favorites = favorites;
    this.plaza = plaza;
  }

  @GetMapping
  public Envelope<Paginated<CapsuleListItem>> list(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "20") int pageSize) {
    UserEntity user = auth.required(authorization);
    return Envelope.ok(plaza.myFavorites(user, page, pageSize));
  }

  @PostMapping
  public Envelope<FavoriteResult> add(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody FavoriteRequest req) {
    UserEntity user = auth.required(authorization);
    return Envelope.ok(favorites.addFavorite(user, req.capsuleId()));
  }

  @DeleteMapping("/{capsuleId}")
  public ResponseEntity<Void> remove(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable String capsuleId) {
    favorites.removeFavorite(auth.required(authorization), capsuleId);
    return ResponseEntity.noContent().build();
  }
}
