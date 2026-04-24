package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.dto.Dtos.AuthTokens;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.dto.Dtos.LoginRequest;
import com.hellotimepro.springboot.dto.Dtos.LogoutRequest;
import com.hellotimepro.springboot.dto.Dtos.RefreshRequest;
import com.hellotimepro.springboot.dto.Dtos.RegisterRequest;
import com.hellotimepro.springboot.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public Envelope<AuthTokens> register(@Valid @RequestBody RegisterRequest req) {
    return Envelope.ok(auth.register(req));
  }

  @PostMapping("/login")
  public Envelope<AuthTokens> login(@Valid @RequestBody LoginRequest req) {
    return Envelope.ok(auth.login(req));
  }

  @PostMapping("/refresh")
  public Envelope<AuthTokens> refresh(@Valid @RequestBody RefreshRequest req) {
    return Envelope.ok(auth.refresh(req.refreshToken()));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(@RequestBody(required = false) LogoutRequest req) {
    auth.logout(req == null ? null : req.refreshToken());
    return ResponseEntity.noContent().build();
  }
}
