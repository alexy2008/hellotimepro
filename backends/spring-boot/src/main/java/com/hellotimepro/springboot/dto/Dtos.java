package com.hellotimepro.springboot.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

public final class Dtos {
  private Dtos() {}

  public record Envelope<T>(boolean success, T data, String message, String errorCode) {
    public static <T> Envelope<T> ok(T data) {
      return new Envelope<>(true, data, null, null);
    }
  }

  public record ErrorDetail(String field, String message) {}

  public record ErrorEnvelope(
      boolean success,
      Object data,
      String message,
      String errorCode,
      List<ErrorDetail> details
  ) {}

  public record Pagination(int page, int pageSize, long total, int totalPages) {}

  public record Paginated<T>(List<T> items, Pagination pagination) {}

  public record UserOut(String id, String email, String nickname, String avatarId, OffsetDateTime createdAt) {}

  public record UserBrief(String nickname, String avatarId) {}

  public record Avatar(String id, String name, String primaryColor, String svgUrl) {}

  public record AuthTokens(
      String accessToken,
      String refreshToken,
      int accessTokenExpiresIn,
      int refreshTokenExpiresIn,
      UserOut user
  ) {}

  public record RegisterRequest(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,128}$") String password,
      @NotBlank @Size(min = 2, max = 20) @Pattern(regexp = "^[\\p{L}\\p{N}_-]{2,20}$") String nickname,
      @NotBlank @Size(min = 2, max = 20) @Pattern(regexp = "^[a-z0-9-]+$") String avatarId
  ) {}

  public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

  public record RefreshRequest(@NotBlank String refreshToken) {}

  public record LogoutRequest(String refreshToken) {}

  public record UpdateProfileRequest(
      @Size(min = 2, max = 20) @Pattern(regexp = "^[\\p{L}\\p{N}_-]{2,20}$") String nickname,
      @Size(min = 2, max = 20) @Pattern(regexp = "^[a-z0-9-]+$") String avatarId
  ) {}

  public record ChangePasswordRequest(
      @NotBlank String currentPassword,
      @NotBlank @Size(min = 8, max = 128) @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,128}$") String newPassword
  ) {}

  public record CreateCapsuleRequest(
      @NotBlank @Size(min = 1, max = 60) String title,
      @NotBlank @Size(min = 1, max = 5000) String content,
      @NotNull OffsetDateTime openAt,
      Boolean inPlaza
  ) {}

  public record FavoriteRequest(@NotBlank String capsuleId) {}

  public record CapsuleBase(
      String id,
      String code,
      String title,
      UserBrief creator,
      OffsetDateTime openAt,
      OffsetDateTime createdAt,
      boolean inPlaza,
      int favoriteCount,
      boolean isOpened
  ) {}

  public record CapsuleDetail(
      String id,
      String code,
      String title,
      UserBrief creator,
      OffsetDateTime openAt,
      OffsetDateTime createdAt,
      boolean inPlaza,
      int favoriteCount,
      boolean isOpened,
      String content,
      boolean favoritedByMe
  ) {}

  public record CapsuleListItem(
      String id,
      String code,
      String title,
      UserBrief creator,
      OffsetDateTime openAt,
      OffsetDateTime createdAt,
      boolean inPlaza,
      int favoriteCount,
      boolean isOpened,
      boolean favoritedByMe,
      OffsetDateTime favoritedAt
  ) {}

  public record FavoriteResult(String capsuleId, int favoriteCount, OffsetDateTime favoritedAt) {}

  public record StackItem(String role, String name, String version, String iconUrl) {}

  public record StackInfo(String kind, List<StackItem> items) {}

  public record HealthData(String status, String service, String version, long uptimeSeconds, StackInfo stack) {}
}
