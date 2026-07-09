using System.Collections.Generic;

namespace HelloTimePro.Models;

// ============================================================
// 领域模型：与 spec/api/openapi.yaml 对齐（对照 frontends/react-ts/src/types/index.ts
// 与 desktop/swiftui .../Models/Models.swift）。
//
// JSON 走 camelCase（见 Api/ApiClient 的 JsonSerializerOptions）：C# 属性用 PascalCase，
// 序列化时自动映射 accessToken/errorCode 等 camelCase 字段。可空即契约允许缺省。
// ============================================================

/// 统一响应包装。
public sealed record Envelope<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public string? ErrorCode { get; init; }
    public List<FieldError>? Details { get; init; }
}

public sealed record FieldError(string Field, string Message);

public sealed record Pagination
{
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int Total { get; init; }
    public int TotalPages { get; init; }
}

/// 分页容器（对照 Swift 的 Page<T> / TS 的 PaginatedCapsules）。
public sealed record Page<T>
{
    public List<T> Items { get; init; } = new();
    public Pagination Pagination { get; init; } = new();
}

public sealed record Avatar
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string PrimaryColor { get; init; } = "";
    public string? SvgUrl { get; init; }
}

public sealed record User
{
    public string Id { get; init; } = "";
    public string Email { get; init; } = "";
    public string Nickname { get; init; } = "";
    public string AvatarId { get; init; } = "";
    public string CreatedAt { get; init; } = "";
}

public sealed record UserBrief
{
    public string Nickname { get; init; } = "";
    public string AvatarId { get; init; } = "";
}

public sealed record CapsuleListItem
{
    public string Id { get; init; } = "";
    public string Code { get; init; } = "";
    public string Title { get; init; } = "";
    public UserBrief Creator { get; init; } = new();
    public string OpenAt { get; init; } = "";
    public string CreatedAt { get; init; } = "";
    public bool InPlaza { get; init; }
    public int FavoriteCount { get; init; }
    public bool IsOpened { get; init; }
    public bool FavoritedByMe { get; init; }
    public string? FavoritedAt { get; init; }
    public string? ContentPreview { get; init; }
}

public sealed record CapsuleDetail
{
    public string Id { get; init; } = "";
    public string Code { get; init; } = "";
    public string Title { get; init; } = "";
    public UserBrief Creator { get; init; } = new();
    public string OpenAt { get; init; } = "";
    public string CreatedAt { get; init; } = "";
    public bool InPlaza { get; init; }
    public int FavoriteCount { get; init; }
    public bool IsOpened { get; init; }
    public string? Content { get; init; }
    public bool FavoritedByMe { get; init; }
}

public sealed record AuthTokens
{
    public string AccessToken { get; init; } = "";
    public string RefreshToken { get; init; } = "";
    public int AccessTokenExpiresIn { get; init; }
    public int? RefreshTokenExpiresIn { get; init; }
    public User User { get; init; } = new();
}

public sealed record StackItem
{
    public string Role { get; init; } = "";
    public string Name { get; init; } = "";
    public string Version { get; init; } = "";
    public string? IconUrl { get; init; }
}

public sealed record StackInfo
{
    public string Kind { get; init; } = "";
    public string Summary { get; init; } = "";
    public List<StackItem> Items { get; init; } = new();
}

public sealed record HealthData
{
    public string Status { get; init; } = "";
    public string Service { get; init; } = "";
    public string Version { get; init; } = "";
    public int UptimeSeconds { get; init; }
    public StackInfo Stack { get; init; } = new();
}

public sealed record CapsuleSuggestion
{
    public string? Title { get; init; }
    public string Content { get; init; } = "";
    public int OpenInDays { get; init; }
    public string OpenAt { get; init; } = "";
    public string GeneratedBy { get; init; } = "";
    public bool Cached { get; init; }
}

public sealed record CapsuleRecommendation
{
    public string Title { get; init; } = "";
    public string Hint { get; init; } = "";
    public int OpenInDays { get; init; }
}

public sealed record CapsuleRecommendationList
{
    public List<CapsuleRecommendation> Items { get; init; } = new();
    public string GeneratedBy { get; init; } = "";
    public bool Cached { get; init; }
}

public sealed record FavoriteResult
{
    public string CapsuleId { get; init; } = "";
    public int FavoriteCount { get; init; }
    public string FavoritedAt { get; init; } = "";
}

// ---------- 请求体 ----------

public sealed record CapsuleSuggestionRequest(string? Title, string? Locale);
public sealed record CreateCapsuleRequest(string Title, string Content, string OpenAt, bool? InPlaza);
public sealed record RegisterRequest(string Email, string Password, string Nickname, string AvatarId);
public sealed record LoginRequest(string Email, string Password);
public sealed record UpdateProfileRequest(string? Nickname, string? AvatarId);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record RefreshRequest(string RefreshToken);
public sealed record LogoutRequest(string RefreshToken);
public sealed record FavoriteRequest(string CapsuleId);
