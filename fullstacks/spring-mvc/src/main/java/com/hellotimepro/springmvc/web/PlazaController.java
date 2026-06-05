package com.hellotimepro.springmvc.web;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springmvc.dto.Dtos.Envelope;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.service.AuthContext;
import com.hellotimepro.springmvc.service.CapsuleService;
import com.hellotimepro.springmvc.service.PlazaService;
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
    String viewerId = auth.optional(authorization).map(u -> u.getId().toString()).orElse(null);
    return Envelope.ok(plaza.plazaList(sort, filter, q, page, pageSize, viewerId));
  }

  @GetMapping("/capsules/{id}")
  public Envelope<CapsuleDetail> detail(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable String id) {
    String viewerId = auth.optional(authorization).map(u -> u.getId().toString()).orElse(null);
    return Envelope.ok(capsules.getPlazaDetail(id, viewerId));
  }
}
