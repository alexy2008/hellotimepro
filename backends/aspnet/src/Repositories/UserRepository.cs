using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HelloTimePro.Aspnet.Repositories;

/// <summary>
/// 用户仓库。DbContext 即工作单元：写方法只暂存变更，由 service 在业务边界统一 SaveChanges。
/// （查询默认 tracking，便于 service 直接修改已加载实体后保存。）
/// </summary>
public sealed class UserRepository
{
    private readonly AppDbContext _db;
    public UserRepository(AppDbContext db) => _db = db;

    public Task<User?> FindById(Guid id) =>
        _db.Users.FirstOrDefaultAsync(u => u.Id == id);

    public Task<User?> FindByEmail(string email) =>
        _db.Users.FirstOrDefaultAsync(u => u.Email == email);

    public Task<bool> ExistsByEmail(string email) =>
        _db.Users.AnyAsync(u => u.Email == email);

    public Task<bool> ExistsByNickname(string nickname) =>
        _db.Users.AnyAsync(u => u.Nickname == nickname);

    public async Task<List<User>> FindAllByIds(IReadOnlyCollection<Guid> ids) =>
        ids.Count == 0 ? new List<User>() : await _db.Users.Where(u => ids.Contains(u.Id)).ToListAsync();

    /// <summary>暂存新增（不保存）。</summary>
    public void Add(User user) => _db.Users.Add(user);
}
