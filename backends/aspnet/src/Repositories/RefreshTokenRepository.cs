using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HelloTimePro.Aspnet.Repositories;

public sealed class RefreshTokenRepository
{
    private readonly AppDbContext _db;
    private readonly bool _isSqlite;

    public RefreshTokenRepository(AppDbContext db, AppConfig config)
    {
        _db = db;
        _isSqlite = config.IsSqlite;
    }

    public Task<RefreshToken?> FindByTokenHash(string hash) =>
        _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);

    /// <summary>Postgres 用行锁保证同一个 refresh token 只能被一个请求完成轮转。</summary>
    public async Task<RefreshToken?> FindByTokenHashForUpdate(string hash)
    {
        if (_isSqlite)
        {
            return await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        }
        var rows = await _db.RefreshTokens
            .FromSqlRaw("SELECT * FROM refresh_tokens WHERE token_hash = {0} FOR UPDATE", hash)
            .ToListAsync();
        return rows.FirstOrDefault();
    }

    public void Add(RefreshToken token) => _db.RefreshTokens.Add(token);

    /// <summary>吊销整个 family 内未吊销的 token（立即执行，参与当前事务）。</summary>
    public Task RevokeFamily(Guid familyId, DateTimeOffset now) =>
        _db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));

    /// <summary>吊销某用户全部未吊销的 token（改密码后调用）。</summary>
    public Task RevokeUser(Guid userId, DateTimeOffset now) =>
        _db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
}
