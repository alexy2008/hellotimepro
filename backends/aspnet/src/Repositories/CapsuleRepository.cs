using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HelloTimePro.Aspnet.Repositories;

public enum PlazaSort { Hot, New }

public sealed class CapsuleRepository
{
    private readonly AppDbContext _db;
    private readonly bool _isSqlite;

    public CapsuleRepository(AppDbContext db, AppConfig config)
    {
        _db = db;
        _isSqlite = config.IsSqlite;
    }

    public Task<Capsule?> FindById(Guid id) =>
        _db.Capsules.FirstOrDefaultAsync(c => c.Id == id);

    /// <summary>Postgres 用 SELECT ... FOR UPDATE 序列化并发收藏；SQLite 依赖单写事务。</summary>
    public async Task<Capsule?> FindByIdForUpdate(Guid id)
    {
        if (_isSqlite)
        {
            return await _db.Capsules.FirstOrDefaultAsync(c => c.Id == id);
        }
        // ToListAsync 直接执行原始 SQL，避免被包成子查询导致 FOR UPDATE 失效。
        var rows = await _db.Capsules
            .FromSqlRaw("SELECT * FROM capsules WHERE id = {0} FOR UPDATE", id)
            .ToListAsync();
        return rows.FirstOrDefault();
    }

    public Task<Capsule?> FindByCode(string code) =>
        _db.Capsules.FirstOrDefaultAsync(c => c.Code == code);

    public Task<bool> ExistsByCode(string code) =>
        _db.Capsules.AnyAsync(c => c.Code == code);

    public async Task<List<Capsule>> FindAllByIds(IReadOnlyCollection<Guid> ids) =>
        ids.Count == 0 ? new List<Capsule>() : await _db.Capsules.Where(c => ids.Contains(c.Id)).ToListAsync();

    public void Add(Capsule capsule) => _db.Capsules.Add(capsule);

    public void Remove(Capsule capsule) => _db.Capsules.Remove(capsule);

    public async Task<List<Capsule>> FindByOwnerPaged(Guid ownerId, int offset, int limit) =>
        await _db.Capsules
            .Where(c => c.OwnerId == ownerId)
            .OrderByDescending(c => c.CreatedAt)
            .Skip(offset).Take(limit)
            .ToListAsync();

    public Task<int> CountByOwner(Guid ownerId) =>
        _db.Capsules.CountAsync(c => c.OwnerId == ownerId);

    public async Task<List<Capsule>> FindPlazaPaged(
        string filter, DateTimeOffset now, string? q, PlazaSort sort, int offset, int limit)
    {
        var query = PlazaQuery(filter, now, q);
        query = sort == PlazaSort.Hot
            ? query.OrderByDescending(c => c.FavoriteCount).ThenByDescending(c => c.CreatedAt)
            : query.OrderByDescending(c => c.CreatedAt);
        return await query.Skip(offset).Take(limit).ToListAsync();
    }

    public Task<int> CountPlaza(string filter, DateTimeOffset now, string? q) =>
        PlazaQuery(filter, now, q).CountAsync();

    private IQueryable<Capsule> PlazaQuery(string filter, DateTimeOffset now, string? q)
    {
        var query = _db.Capsules.Where(c => c.InPlaza);
        query = filter switch
        {
            "opened" => query.Where(c => c.OpenAt <= now),
            "unopened" => query.Where(c => c.OpenAt > now),
            _ => query,
        };
        if (q != null)
        {
            // 标题 OR 创建者昵称，大小写不敏感子串匹配（q 已 trim+小写）。
            query = query.Where(c =>
                c.Title.ToLower().Contains(q) ||
                _db.Users.Any(u => u.Id == c.OwnerId && u.Nickname.ToLower().Contains(q)));
        }
        return query;
    }
}
