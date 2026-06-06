using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HelloTimePro.Aspnet.Repositories;

public sealed class FavoriteRepository
{
    private readonly AppDbContext _db;
    public FavoriteRepository(AppDbContext db) => _db = db;

    public Task<Favorite?> Find(Guid userId, Guid capsuleId) =>
        _db.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.CapsuleId == capsuleId);

    public Task<bool> Exists(Guid userId, Guid capsuleId) =>
        _db.Favorites.AnyAsync(f => f.UserId == userId && f.CapsuleId == capsuleId);

    public void Add(Favorite favorite) => _db.Favorites.Add(favorite);

    public void Remove(Favorite favorite) => _db.Favorites.Remove(favorite);

    /// <summary>删除某胶囊的全部收藏（立即执行，参与当前事务）。用于删除胶囊。</summary>
    public Task DeleteByCapsule(Guid capsuleId) =>
        _db.Favorites.Where(f => f.CapsuleId == capsuleId).ExecuteDeleteAsync();

    public async Task<List<Favorite>> FindByUserPaged(Guid userId, int offset, int limit) =>
        await _db.Favorites
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Skip(offset).Take(limit)
            .ToListAsync();

    public Task<int> CountByUser(Guid userId) =>
        _db.Favorites.CountAsync(f => f.UserId == userId);

    public async Task<List<Favorite>> FindByUserAndCapsuleIds(Guid userId, IReadOnlyCollection<Guid> capsuleIds) =>
        capsuleIds.Count == 0
            ? new List<Favorite>()
            : await _db.Favorites
                .Where(f => f.UserId == userId && capsuleIds.Contains(f.CapsuleId))
                .ToListAsync();
}
