using System.Text.RegularExpressions;
using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Services;

namespace HelloTimePro.Aspnet.Web;

/// <summary>
/// 从 Authorization 头解析 Bearer JWT 并加载当前用户。Scoped（依赖 scoped 的 UserRepository / DbContext）。
/// 对应 Ktor 的 AuthContext / Spring 的 AuthContext。
/// </summary>
public sealed partial class AuthContext
{
    private readonly SecurityService _security;
    private readonly UserRepository _users;

    public AuthContext(SecurityService security, UserRepository users)
    {
        _security = security;
        _users = users;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    /// <summary>匿名可访问端点：无 / 非法 token 返回 null。</summary>
    public async Task<User?> Optional(string? authorization)
    {
        var token = ParseBearer(authorization);
        if (token is null) return null;
        var decoded = _security.DecodeAccessToken(token);
        if (decoded.Subject is null) return null;
        var id = Times.ParseUuidOrNull(decoded.Subject);
        if (id is null) return null;
        return await _users.FindById(id.Value);
    }

    /// <summary>受保护端点：缺失 / 过期 / 非法 → UNAUTHORIZED。</summary>
    public async Task<User> Required(string? authorization)
    {
        var token = ParseBearer(authorization) ?? throw ApiException.Unauthorized("缺少 access token");
        var decoded = _security.DecodeAccessToken(token);
        if (decoded.Subject is null) throw ApiException.Unauthorized(decoded.Error ?? "invalid_token");
        var id = Times.ParseUuidOrNull(decoded.Subject) ?? throw ApiException.Unauthorized("invalid_token");
        return await _users.FindById(id) ?? throw ApiException.Unauthorized("用户不存在");
    }

    private static string? ParseBearer(string? authorization)
    {
        if (string.IsNullOrWhiteSpace(authorization)) return null;
        var parts = Whitespace().Split(authorization.Trim(), 2);
        if (parts.Length != 2 || !parts[0].Equals("bearer", StringComparison.OrdinalIgnoreCase)) return null;
        return parts[1].Trim();
    }
}
