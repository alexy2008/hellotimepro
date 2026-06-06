using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Infrastructure;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

/// <summary>注册 / 登录 / 刷新（轮转 + 家族吊销）/ 登出 / 改密码。</summary>
public sealed class AuthService
{
    private readonly AppDbContext _db;
    private readonly AppConfig _config;
    private readonly UserRepository _users;
    private readonly RefreshTokenRepository _refreshTokens;
    private readonly SecurityService _security;
    private readonly MapperService _mapper;
    private readonly AvatarService _avatars;
    private readonly LoginRateLimiter _rateLimiter;

    public AuthService(
        AppDbContext db, AppConfig config, UserRepository users, RefreshTokenRepository refreshTokens,
        SecurityService security, MapperService mapper, AvatarService avatars, LoginRateLimiter rateLimiter)
    {
        _db = db;
        _config = config;
        _users = users;
        _refreshTokens = refreshTokens;
        _security = security;
        _mapper = mapper;
        _avatars = avatars;
        _rateLimiter = rateLimiter;
    }

    public async Task<AuthTokens> Register(RegisterRequest req)
    {
        var email = Validation.Email(req.Email).ToLowerInvariant();
        var rawPassword = Validation.Password(req.Password);
        var nickname = Validation.Nickname(req.Nickname);
        var avatarId = Validation.AvatarFormat(req.AvatarId);
        if (!_avatars.Exists(avatarId)) throw ApiException.Validation("头像 ID 不存在", "avatarId");

        if (await _users.ExistsByEmail(email)) throw ApiException.Conflict("邮箱已被注册", "email");
        if (await _users.ExistsByNickname(nickname)) throw ApiException.Conflict("昵称已被使用", "nickname");

        var now = Times.NowUtc();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = _security.HashPassword(rawPassword),
            Nickname = nickname,
            AvatarId = avatarId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        _users.Add(user);
        var tokens = IssueTokenPair(user, null);
        await _db.SaveChangesAsync();
        return tokens;
    }

    public async Task<AuthTokens> Login(LoginRequest req)
    {
        var email = Validation.Email(req.Email).ToLowerInvariant();
        var password = Validation.RequireNonBlank(req.Password, "password");
        _rateLimiter.Check(email);

        var user = await _users.FindByEmail(email);
        if (user is null || !_security.VerifyPassword(password, user.PasswordHash))
        {
            _rateLimiter.RecordFailure(email);
            throw ApiException.Unauthorized("邮箱或密码错误");
        }
        var tokens = IssueTokenPair(user, null);
        await _db.SaveChangesAsync();
        return tokens;
    }

    public async Task<AuthTokens> Refresh(string? rawRefresh)
    {
        var raw = Validation.RequireNonBlank(rawRefresh, "refreshToken");
        var tokenHash = _security.HashRefreshToken(raw);

        // 关键：重用检测分支必须先提交 family 吊销再抛 401，所以事务内不抛异常、用 outcome 区分，
        // throw 放到事务外（对应 Ktor/Spring 的 noRollbackFor 语义）。
        Outcome outcome;
        AuthTokens? success = null;

        await using (var tx = await _db.Database.BeginTransactionAsync())
        {
            var row = await _refreshTokens.FindByTokenHashForUpdate(tokenHash);
            var now = Times.NowUtc();
            if (row is null || row.ExpiresAt <= now)
            {
                outcome = Outcome.Invalid;
            }
            else if (row.RevokedAt is not null)
            {
                await _refreshTokens.RevokeFamily(row.FamilyId, now);
                outcome = Outcome.Reused;
            }
            else
            {
                var user = await _users.FindById(row.UserId);
                if (user is null)
                {
                    outcome = Outcome.Invalid;
                }
                else
                {
                    row.RevokedAt = now; // 旧 token 标记吊销（tracked）
                    success = IssueTokenPair(user, row.FamilyId);
                    await _db.SaveChangesAsync();
                    outcome = Outcome.Success;
                }
            }
            await tx.CommitAsync();
        }

        return outcome switch
        {
            Outcome.Success => success!,
            Outcome.Reused => throw ApiException.Unauthorized("refresh token 已失效"),
            _ => throw ApiException.Unauthorized("refresh token 无效"),
        };
    }

    public async Task Logout(string? rawRefresh)
    {
        if (string.IsNullOrWhiteSpace(rawRefresh)) return;
        var hash = _security.HashRefreshToken(rawRefresh);
        var row = await _refreshTokens.FindByTokenHash(hash);
        if (row is not null && row.RevokedAt is null)
        {
            row.RevokedAt = Times.NowUtc();
            await _db.SaveChangesAsync();
        }
    }

    public async Task ChangePassword(User user, ChangePasswordRequest req)
    {
        Validation.RequireNonBlank(req.CurrentPassword, "currentPassword");
        var newPassword = Validation.Password(req.NewPassword, "newPassword");
        if (!_security.VerifyPassword(req.CurrentPassword!, user.PasswordHash))
        {
            throw ApiException.Unauthorized("当前密码错误");
        }
        await using var tx = await _db.Database.BeginTransactionAsync();
        user.PasswordHash = _security.HashPassword(newPassword);
        user.UpdatedAt = Times.NowUtc();
        await _db.SaveChangesAsync();
        await _refreshTokens.RevokeUser(user.Id, Times.NowUtc());
        await tx.CommitAsync();
    }

    /// <summary>在当前工作单元内签发 access + refresh 对，并暂存 refresh token 行（由调用方 SaveChanges）。</summary>
    private AuthTokens IssueTokenPair(User user, Guid? familyId)
    {
        var access = _security.CreateAccessToken(user);
        var refresh = _security.GenerateRefreshToken();
        var now = Times.NowUtc();
        _refreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = _security.HashRefreshToken(refresh),
            FamilyId = familyId ?? Guid.NewGuid(),
            ExpiresAt = now.AddSeconds(_config.RefreshTokenTtlSeconds),
            CreatedAt = now,
            RevokedAt = null,
        });
        return new AuthTokens(
            access, refresh, _config.AccessTokenTtlSeconds, _config.RefreshTokenTtlSeconds, _mapper.User(user));
    }

    private enum Outcome { Success, Invalid, Reused }
}
