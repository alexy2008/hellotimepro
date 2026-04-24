package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.domain.UserEntity;
import com.hellotimepro.springboot.dto.Dtos.CapsuleDetail;
import com.hellotimepro.springboot.dto.Dtos.CreateCapsuleRequest;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.service.AuthContext;
import com.hellotimepro.springboot.service.CapsuleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/capsules")
public class CapsuleController {
  private final AuthContext auth;
  private final CapsuleService capsules;

  public CapsuleController(AuthContext auth, CapsuleService capsules) {
    this.auth = auth;
    this.capsules = capsules;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Envelope<CapsuleDetail> create(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody CreateCapsuleRequest req) {
    UserEntity user = auth.required(authorization);
    return Envelope.ok(capsules.create(user, req));
  }

  @GetMapping("/{code}")
  public Envelope<CapsuleDetail> getByCode(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable String code) {
    String viewerId = auth.optional(authorization).map(UserEntity::getId).orElse(null);
    return Envelope.ok(capsules.getByCode(code, viewerId));
  }
}
