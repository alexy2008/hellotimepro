using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Infrastructure;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

public sealed class FavoriteService
{
    private readonly AppDbContext _db;
    private readonly CapsuleRepository _capsules;
    private readonly FavoriteRepository _favorites;

    public FavoriteService(AppDbContext db, CapsuleRepository capsules, FavoriteRepository favorites)
    {
        _db = db;
        _capsules = capsules;
        _favorites = favorites;
    }

    public async Task<FavoriteResult> AddFavorite(User user, string? capsuleIdRaw)
    {
        var capsuleId = Times.ParseUuidOrNull(capsuleIdRaw) ?? throw ApiException.NotFound("胶囊不存在");

        // favorite_count 是冗余计数器，必须与 favorites 行变更同处一个事务。
        // Postgres 路径取胶囊行写锁；SQLite 依赖单写事务与原子提交。
        await using var tx = await _db.Database.BeginTransactionAsync();
        var capsule = await _capsules.FindByIdForUpdate(capsuleId) ?? throw ApiException.NotFound("胶囊不存在");
        if (!capsule.InPlaza) throw ApiException.NotFound("胶囊不存在");
        if (capsule.OwnerId == user.Id) throw ApiException.BadRequest("不能收藏自己创建的胶囊");

        var existing = await _favorites.Find(user.Id, capsule.Id);
        if (existing is not null)
        {
            await tx.CommitAsync();
            return new FavoriteResult(capsule.Id.ToString(), capsule.FavoriteCount, Times.Iso(existing.CreatedAt));
        }

        var now = Times.NowUtc();
        _favorites.Add(new Favorite { UserId = user.Id, CapsuleId = capsule.Id, CreatedAt = now });
        capsule.FavoriteCount += 1;
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return new FavoriteResult(capsule.Id.ToString(), capsule.FavoriteCount, Times.Iso(now));
    }

    public async Task RemoveFavorite(User user, string capsuleIdRaw)
    {
        // 取消收藏幂等：胶囊不存在 / 格式非法 / 原本未收藏都返回成功（204）。
        var capsuleId = Times.ParseUuidOrNull(capsuleIdRaw);
        if (capsuleId is null) return;

        await using var tx = await _db.Database.BeginTransactionAsync();
        var capsule = await _capsules.FindByIdForUpdate(capsuleId.Value);
        if (capsule is null)
        {
            await tx.CommitAsync();
            return;
        }
        var favorite = await _favorites.Find(user.Id, capsule.Id);
        if (favorite is not null)
        {
            _favorites.Remove(favorite);
            capsule.FavoriteCount = Math.Max(0, capsule.FavoriteCount - 1);
            await _db.SaveChangesAsync();
        }
        await tx.CommitAsync();
    }
}
