package com.hellotimepro.springmvc.web;

import com.hellotimepro.springmvc.domain.UserEntity;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleListItem;
import com.hellotimepro.springmvc.dto.Dtos.ChangePasswordRequest;
import com.hellotimepro.springmvc.dto.Dtos.Envelope;
import com.hellotimepro.springmvc.dto.Dtos.Paginated;
import com.hellotimepro.springmvc.dto.Dtos.UpdateProfileRequest;
import com.hellotimepro.springmvc.dto.Dtos.UserOut;
import com.hellotimepro.springmvc.service.AuthContext;
import com.hellotimepro.springmvc.service.AuthService;
import com.hellotimepro.springmvc.service.CapsuleService;
import com.hellotimepro.springmvc.service.PlazaService;
import com.hellotimepro.springmvc.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {
  private final AuthContext authContext;
  private final UserService users;
  private final AuthService auth;
  private final PlazaService plaza;
  private final CapsuleService capsules;

  public MeController(AuthContext authContext, UserService users, AuthService auth,
      PlazaService plaza, CapsuleService capsules) {
    this.authContext = authContext;
    this.users = users;
    this.auth = auth;
    this.plaza = plaza;
    this.capsules = capsules;
  }

  @GetMapping
  public Envelope<UserOut> me(@RequestHeader(value = "Authorization", required = false) String authorization) {
    return Envelope.ok(users.toOut(authContext.required(authorization)));
  }

  @PatchMapping
  public Envelope<UserOut> patchMe(@RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody UpdateProfileRequest req) {
    return Envelope.ok(users.updateProfile(authContext.required(authorization), req));
  }

  @PostMapping("/password")
  public ResponseEntity<Void> password(@RequestHeader(value = "Authorization", required = false) String authorization,
      @Valid @RequestBody ChangePasswordRequest req) {
    auth.changePassword(authContext.required(authorization), req);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/capsules")
  public Envelope<Paginated<CapsuleListItem>> myCapsules(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "20") int pageSize) {
    UserEntity user = authContext.required(authorization);
    return Envelope.ok(plaza.myCapsules(user, page, pageSize));
  }

  @DeleteMapping("/capsules/{id}")
  public ResponseEntity<Void> deleteCapsule(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @PathVariable String id) {
    capsules.deleteOwn(authContext.required(authorization), id);
    return ResponseEntity.noContent().build();
  }
}
