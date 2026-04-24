package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springboot.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.dto.Dtos.Paginated;
import com.hellotimepro.springboot.service.AuthContext;
import com.hellotimepro.springboot.service.CapsuleService;
import com.hellotimepro.springboot.service.PlazaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/plaza")
public class PlazaController {
  private final AuthContext auth;
  private final PlazaService plaza;
  private final CapsuleService capsules;

  public PlazaController(AuthContext auth, PlazaService plaza, CapsuleService capsules) {
    this.auth = auth;
    this.plaza = plaza;
    this.capsules = capsules;
  }

  @GetMapping("/capsules")
  public Envelope<Paginated<CapsuleListItem>> list(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam(defaultValue = "new") String sort,
      @RequestParam(defaultValue = "all") String filter,
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "20") int pageSize) {
    String viewerId = auth.optional(authorization).map(UserEntity::getId).orElse(null);
    return Envelope.ok(plaza.plazaList(sort, filter, q, page, pageSize, viewerId));
  }

  @GetMapping("/capsules/{id}")
  public Envelope<CapsuleDetail> detail(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable String id) {
    String viewerId = auth.optional(authorization).map(UserEntity::getId).orElse(null);
    return Envelope.ok(capsules.getPlazaDetail(id, viewerId));
  }
}
