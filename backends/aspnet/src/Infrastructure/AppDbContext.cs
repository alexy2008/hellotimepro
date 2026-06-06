using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Domain;
using Microsoft.EntityFrameworkCore;

namespace HelloTimePro.Aspnet.Infrastructure;

/// <summary>
/// EF Core 上下文。结构对齐 spec/db/schema.sql；不做 DDL/迁移/seed（由 scripts/db 负责）。
/// 跨库存储差异通过 OnModelCreating 里按 provider 挂载的 ValueConverter 处理（见 <see cref="CrossDb"/>）。
/// </summary>
public sealed class AppDbContext : DbContext
{
    private readonly bool _isSqlite;

    public AppDbContext(DbContextOptions<AppDbContext> options, AppConfig config) : base(options)
    {
        _isSqlite = config.IsSqlite;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Capsule> Capsules => Set<Capsule>();
    public DbSet<Favorite> Favorites => Set<Favorite>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Email).HasColumnName("email");
            e.Property(x => x.PasswordHash).HasColumnName("password_hash");
            e.Property(x => x.Nickname).HasColumnName("nickname");
            e.Property(x => x.AvatarId).HasColumnName("avatar_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        b.Entity<Capsule>(e =>
        {
            e.ToTable("capsules");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.OwnerId).HasColumnName("owner_id");
            e.Property(x => x.Code).HasColumnName("code");
            e.Property(x => x.Title).HasColumnName("title");
            e.Property(x => x.Content).HasColumnName("content");
            e.Property(x => x.OpenAt).HasColumnName("open_at");
            e.Property(x => x.InPlaza).HasColumnName("in_plaza");
            e.Property(x => x.FavoriteCount).HasColumnName("favorite_count");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            // 声明 FK 依赖，让 EF 正确排序级联插入（capsule 在 owner 之后）。
            e.HasOne<User>().WithMany().HasForeignKey(x => x.OwnerId);
        });

        b.Entity<Favorite>(e =>
        {
            e.ToTable("favorites");
            e.HasKey(x => new { x.UserId, x.CapsuleId });
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.CapsuleId).HasColumnName("capsule_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
            e.HasOne<Capsule>().WithMany().HasForeignKey(x => x.CapsuleId);
        });

        b.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.TokenHash).HasColumnName("token_hash");
            e.Property(x => x.FamilyId).HasColumnName("family_id");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            // refresh_token 在其 user 之后插入。
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        });

        if (_isSqlite)
        {
            ApplySqliteConverters(b);
        }
    }

    /// <summary>SQLite：UUID → 32 位 hex TEXT、时间戳 → ISO-8601 TEXT，覆盖 EF 默认存储格式。</summary>
    private static void ApplySqliteConverters(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.Property(x => x.Id).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.CreatedAt).HasConversion(CrossDb.TimestampToIso);
            e.Property(x => x.UpdatedAt).HasConversion(CrossDb.TimestampToIso);
        });
        b.Entity<Capsule>(e =>
        {
            e.Property(x => x.Id).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.OwnerId).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.OpenAt).HasConversion(CrossDb.TimestampToIso);
            e.Property(x => x.CreatedAt).HasConversion(CrossDb.TimestampToIso);
            e.Property(x => x.UpdatedAt).HasConversion(CrossDb.TimestampToIso);
        });
        b.Entity<Favorite>(e =>
        {
            e.Property(x => x.UserId).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.CapsuleId).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.CreatedAt).HasConversion(CrossDb.TimestampToIso);
        });
        b.Entity<RefreshToken>(e =>
        {
            e.Property(x => x.Id).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.UserId).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.FamilyId).HasConversion(CrossDb.GuidToHex);
            e.Property(x => x.ExpiresAt).HasConversion(CrossDb.TimestampToIso);
            e.Property(x => x.CreatedAt).HasConversion(CrossDb.TimestampToIso);
            e.Property(x => x.RevokedAt).HasConversion(CrossDb.NullableTimestampToIso);
        });
    }
}
