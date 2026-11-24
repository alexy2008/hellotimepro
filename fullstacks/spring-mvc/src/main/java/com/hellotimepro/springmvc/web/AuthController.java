package com.hellotimepro.springmvc.web;

import com.hellotimepro.springmvc.dto.Dtos.AuthTokens;
import com.hellotimepro.springmvc.dto.Dtos.Envelope;
import com.hellotimepro.springmvc.dto.Dtos.LoginRequest;
import com.hellotimepro.springmvc.dto.Dtos.LogoutRequest;
import com.hellotimepro.springmvc.dto.Dtos.RefreshRequest;
import com.hellotimepro.springmvc.dto.Dtos.RegisterRequest;
import com.hellotimepro.springmvc.service.AuthService;
import com.hellotimepro.springmvc.web.view.CookieAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
  private final CookieAuthService cookieAuth;

  public AuthController(AuthService auth, CookieAuthService cookieAuth) {
    this.auth = auth;
    this.cookieAuth = cookieAuth;
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public Envelope<AuthTokens> register(@Valid @RequestBody RegisterRequest req, HttpServletResponse res) {
    AuthTokens tokens = auth.register(req);
    cookieAuth.setAuthCookies(res, tokens);
    return Envelope.ok(tokens);
  }

  @PostMapping("/login")
  public Envelope<AuthTokens> login(@Valid @RequestBody LoginRequest req, HttpServletResponse res) {
    AuthTokens tokens = auth.login(req);
    cookieAuth.setAuthCookies(res, tokens);
    return Envelope.ok(tokens);
  }

  @PostMapping("/refresh")
  public Envelope<AuthTokens> refresh(@Valid @RequestBody RefreshRequest req, HttpServletResponse res) {
    AuthTokens tokens = auth.refresh(req.refreshToken());
    cookieAuth.setAuthCookies(res, tokens);
    return Envelope.ok(tokens);
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(@RequestBody(required = false) LogoutRequest req,
      HttpServletRequest httpReq, HttpServletResponse res) {
    String rt = (req != null && req.refreshToken() != null && !req.refreshToken().isBlank())
        ? req.refreshToken()
        : cookieAuth.readRefresh(httpReq);
    auth.logout(rt);
    cookieAuth.clearAuthCookies(res);
    return ResponseEntity.noContent().build();
  }
}
