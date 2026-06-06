using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Domain;
using Microsoft.IdentityModel.Tokens;

namespace HelloTimePro.Aspnet.Services;

/// <summary>密码哈希（bcrypt）与 JWT（HS256）+ refresh token 生成/哈希。单例，无可变状态。</summary>
public sealed class SecurityService
{
    private readonly AppConfig _config;
    private readonly SymmetricSecurityKey _key;
    private readonly JwtSecurityTokenHandler _handler = new();
    private readonly TokenValidationParameters _validation;

    public SecurityService(AppConfig config)
    {
        _config = config;
        // Microsoft.IdentityModel 强制 HS256 密钥 ≥256 位；用 SHA-256 把任意长度 secret
        // 派生为固定 32 字节密钥（签发与校验同源，契约不跨后端验签，安全语义不变）。
        _key = new SymmetricSecurityKey(SHA256.HashData(Encoding.UTF8.GetBytes(config.JwtSecret)));
        _validation = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = _key,
            ClockSkew = TimeSpan.Zero,
        };
    }

    public string HashPassword(string plain) => BCrypt.Net.BCrypt.HashPassword(plain, 10);

    public bool VerifyPassword(string plain, string hashed)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(plain, hashed);
        }
        catch
        {
            return false;
        }
    }

    public string CreateAccessToken(User user)
    {
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim("nickname", user.Nickname),
                new Claim("avatarId", user.AvatarId),
            },
            notBefore: now,
            expires: now.AddSeconds(_config.AccessTokenTtlSeconds),
            signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
        // iat
        token.Payload[JwtRegisteredClaimNames.Iat] = new DateTimeOffset(now).ToUnixTimeSeconds();
        return _handler.WriteToken(token);
    }

    /// <summary>校验 access token。过期统一 error="access_token_expired"；其它非法 error="invalid_token"。</summary>
    public DecodeResult DecodeAccessToken(string token)
    {
        try
        {
            var principal = _handler.ValidateToken(token, _validation, out _);
            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                      ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return new DecodeResult(sub, sub is null ? "invalid_token" : null);
        }
        catch (SecurityTokenExpiredException)
        {
            return new DecodeResult(null, "access_token_expired");
        }
        catch (Exception)
        {
            return new DecodeResult(null, "invalid_token");
        }
    }

    public string GenerateRefreshToken()
    {
        var raw = RandomNumberGenerator.GetBytes(32);
        return Base64UrlEncoder.Encode(raw);
    }

    public string HashRefreshToken(string raw)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    public readonly record struct DecodeResult(string? Subject, string? Error);
}
