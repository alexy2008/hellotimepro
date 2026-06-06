using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Dto;

namespace HelloTimePro.Aspnet.Services;

/// <summary>领域模型 → 响应 DTO。时间统一序列化为 ISO-8601 UTC（<c>...Z</c>）。单例、无状态。</summary>
public sealed class MapperService
{
    public UserDto User(User u) =>
        new(u.Id.ToString(), u.Email, u.Nickname, u.AvatarId, Times.Iso(u.CreatedAt));

    public CapsuleDetail Detail(Capsule c, User owner, bool favoritedByMe, bool includeContent = true)
    {
        var opened = IsOpened(c.OpenAt);
        return new CapsuleDetail(
            Id: c.Id.ToString(),
            Code: c.Code,
            Title: c.Title,
            Creator: new UserBrief(owner.Nickname, owner.AvatarId),
            OpenAt: Times.Iso(c.OpenAt),
            CreatedAt: Times.Iso(c.CreatedAt),
            InPlaza: c.InPlaza,
            FavoriteCount: c.FavoriteCount,
            IsOpened: opened,
            Content: opened && includeContent ? c.Content : null,
            FavoritedByMe: favoritedByMe);
    }

    public CapsuleListItem ListItem(Capsule c, User owner, bool favoritedByMe, DateTimeOffset? favoritedAt)
    {
        var opened = IsOpened(c.OpenAt);
        string? preview = null;
        if (opened)
        {
            var raw = c.Content.Trim();
            preview = raw.Length > 80 ? raw[..80] + "…" : raw;
        }
        return new CapsuleListItem(
            Id: c.Id.ToString(),
            Code: c.Code,
            Title: c.Title,
            Creator: new UserBrief(owner.Nickname, owner.AvatarId),
            OpenAt: Times.Iso(c.OpenAt),
            CreatedAt: Times.Iso(c.CreatedAt),
            InPlaza: c.InPlaza,
            FavoriteCount: c.FavoriteCount,
            IsOpened: opened,
            FavoritedByMe: favoritedByMe,
            FavoritedAt: favoritedAt is null ? null : Times.Iso(favoritedAt.Value),
            ContentPreview: preview);
    }

    private static bool IsOpened(DateTimeOffset openAt) => openAt <= Times.NowUtc();
}
