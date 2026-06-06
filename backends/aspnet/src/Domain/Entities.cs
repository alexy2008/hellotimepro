namespace HelloTimePro.Aspnet.Domain;

/// <summary>
/// 领域模型，同时充当 EF Core 实体（与数据库行一一对应）。
/// 结构对齐 spec/db/schema.sql；表/索引由 scripts/db 维护，本应用不做 DDL/迁移。
/// 时间统一以 UTC 的 <see cref="DateTimeOffset"/> 持有。
/// </summary>
public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Nickname { get; set; } = "";
    public string AvatarId { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class Capsule
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public DateTimeOffset OpenAt { get; set; }
    public bool InPlaza { get; set; }
    public int FavoriteCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class Favorite
{
    public Guid UserId { get; set; }
    public Guid CapsuleId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public Guid FamilyId { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
