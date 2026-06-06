using System.Text.Json.Serialization;

namespace HelloTimePro.Aspnet.Dto;

// ── 统一响应外壳 ───────────────────────────────────────────────────────────

/// <summary>成功响应外壳：<c>{ success, data, message, errorCode }</c>。</summary>
public sealed record Envelope<T>(bool Success, T? Data, string? Message, string? ErrorCode)
{
    public static Envelope<T> Ok(T data) => new(true, data, null, null);
}

public sealed record ErrorDetail(string Field, string Message);

/// <summary>失败响应外壳。data 恒为 null；details 仅 VALIDATION_ERROR / 带字段的 CONFLICT 时出现。</summary>
public sealed record ErrorEnvelope(string Message, string ErrorCode)
{
    public bool Success => false;
    public object? Data => null;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<ErrorDetail>? Details { get; init; }
}

public sealed record Pagination(int Page, int PageSize, long Total, int TotalPages);

public sealed record Paginated<T>(IReadOnlyList<T> Items, Pagination Pagination);

// ── 用户 / 头像 ────────────────────────────────────────────────────────────

public sealed record UserDto(string Id, string Email, string Nickname, string AvatarId, string CreatedAt);

public sealed record UserBrief(string Nickname, string AvatarId);

public sealed record AvatarDto(string Id, string Name, string PrimaryColor, string? SvgUrl);

// ── 鉴权 ───────────────────────────────────────────────────────────────────

public sealed record AuthTokens(
    string AccessToken,
    string RefreshToken,
    long AccessTokenExpiresIn,
    long RefreshTokenExpiresIn,
    UserDto User);

public sealed record RegisterRequest(string? Email, string? Password, string? Nickname, string? AvatarId);

public sealed record LoginRequest(string? Email, string? Password);

public sealed record RefreshRequest(string? RefreshToken);

public sealed record LogoutRequest(string? RefreshToken);

public sealed record UpdateProfileRequest(string? Nickname, string? AvatarId);

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

// ── 胶囊 ───────────────────────────────────────────────────────────────────

public sealed record CreateCapsuleRequest(string? Title, string? Content, string? OpenAt, bool? InPlaza);

public sealed record FavoriteRequest(string? CapsuleId);

/// <summary>单个胶囊详情：含 content（未开启为 null）。</summary>
public sealed record CapsuleDetail(
    string Id,
    string Code,
    string Title,
    UserBrief Creator,
    string OpenAt,
    string CreatedAt,
    bool InPlaza,
    int FavoriteCount,
    bool IsOpened,
    string? Content,
    bool FavoritedByMe);

/// <summary>列表项：不含 content，含 contentPreview / favoritedAt。</summary>
public sealed record CapsuleListItem(
    string Id,
    string Code,
    string Title,
    UserBrief Creator,
    string OpenAt,
    string CreatedAt,
    bool InPlaza,
    int FavoriteCount,
    bool IsOpened,
    bool FavoritedByMe,
    string? FavoritedAt,
    string? ContentPreview);

public sealed record FavoriteResult(string CapsuleId, int FavoriteCount, string FavoritedAt);

// ── 健康检查 ───────────────────────────────────────────────────────────────

public sealed record StackItem(string Role, string Name, string Version, string? IconUrl);

public sealed record StackInfo(string Kind, string Summary, IReadOnlyList<StackItem> Items);

public sealed record HealthData(
    string Status,
    string Service,
    string Version,
    long UptimeSeconds,
    StackInfo Stack);

// ── AI 建议 / 推荐 ─────────────────────────────────────────────────────────

public sealed record CapsuleSuggestionRequest(string? Title, string? Locale);

public sealed record CapsuleSuggestion(
    // 仅空标题模式下返回非 null，供前端回填。
    string? Title,
    string Content,
    int OpenInDays,
    string OpenAt,
    string GeneratedBy,
    bool Cached);

public sealed record CapsuleRecommendationItem(string Title, string Hint, int OpenInDays);

public sealed record CapsuleRecommendationList(
    IReadOnlyList<CapsuleRecommendationItem> Items,
    string GeneratedBy,
    bool Cached);
