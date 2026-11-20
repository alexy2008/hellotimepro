using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

public sealed class PlazaService
{
    private readonly CapsuleRepository _capsules;
    private readonly UserRepository _users;
    private readonly FavoriteRepository _favorites;
    private readonly MapperService _mapper;

    public PlazaService(
        CapsuleRepository capsules, UserRepository users, FavoriteRepository favorites, MapperService mapper)
    {
        _capsules = capsules;
        _users = users;
        _favorites = favorites;
        _mapper = mapper;
    }

    public async Task<Paginated<CapsuleListItem>> PlazaList(
        string sort, string filter, string? q, int page, int pageSize, Guid? viewerId)
    {
        Validation.Page(page, pageSize);
        if (sort != "hot" && sort != "new")
            throw ApiException.Validation("sort 仅支持 hot/new", "sort");
        if (filter != "all" && filter != "opened" && filter != "unopened")
            throw ApiException.Validation("filter 仅支持 all/opened/unopened", "filter");

        var pattern = SearchPattern(q);
        var sortEnum = sort == "hot" ? PlazaSort.Hot : PlazaSort.New;
        var now = Times.NowUtc();

        var total = await _capsules.CountPlaza(filter, now, pattern);
        var rows = await _capsules.FindPlazaPaged(filter, now, pattern, sortEnum, Offset(page, pageSize), pageSize);
        var owners = (await _users.FindAllByIds(rows.Select(r => r.OwnerId).ToList())).ToDictionary(u => u.Id);
        var faved = await LoadFavoriteSet(viewerId, rows.Select(r => r.Id).ToList());

        var items = rows
            .Where(c => owners.ContainsKey(c.OwnerId))
            .Select(c => _mapper.ListItem(c, owners[c.OwnerId], faved.Contains(c.Id), null))
            .ToList();
        return new Paginated<CapsuleListItem>(items, Page(total, page, pageSize));
    }

    public async Task<PlazaStats> PlazaStats(string? q)
    {
        var now = Times.NowUtc();
        var counts = await _capsules.CountPlazaStates(now, SearchPattern(q));
        var farthest = await _capsules.FarthestPlazaOpenAt();
        var next = await _capsules.NextPlazaOpenAt(now);
        return new PlazaStats(
            new PlazaCounts(counts.All, counts.Opened, counts.Unopened),
            farthest is { } farthestAt ? Times.Iso(farthestAt) : null,
            next is { } nextAt ? Times.Iso(nextAt) : null);
    }

    public async Task<MyStats> MyStats(User user)
    {
        var counts = await _capsules.CountOwnerStates(user.Id, Times.NowUtc());
        var given = await _favorites.CountByUser(user.Id);
        return new MyStats(counts.Created, counts.Opened, counts.Unopened, counts.InPlaza, counts.FavoritesReceived, given);
    }

    public async Task<Paginated<CapsuleListItem>> MyCapsules(User user, int page, int pageSize)
    {
        Validation.Page(page, pageSize);
        var total = await _capsules.CountByOwner(user.Id);
        var rows = await _capsules.FindByOwnerPaged(user.Id, Offset(page, pageSize), pageSize);
        var faved = await LoadFavoriteSet(user.Id, rows.Select(c => c.Id).ToList());
        var items = rows.Select(c => _mapper.ListItem(c, user, faved.Contains(c.Id), favoritedAt: null)).ToList();
        return new Paginated<CapsuleListItem>(items, Page(total, page, pageSize));
    }

    public async Task<Paginated<CapsuleListItem>> MyFavorites(User user, int page, int pageSize)
    {
        Validation.Page(page, pageSize);
        var total = await _favorites.CountByUser(user.Id);
        var favs = await _favorites.FindByUserPaged(user.Id, Offset(page, pageSize), pageSize);
        if (favs.Count == 0)
            return new Paginated<CapsuleListItem>(new List<CapsuleListItem>(), Page(total, page, pageSize));

        var capsuleMap = (await _capsules.FindAllByIds(favs.Select(f => f.CapsuleId).ToList()))
            .ToDictionary(c => c.Id);
        var owners = (await _users.FindAllByIds(capsuleMap.Values.Select(c => c.OwnerId).ToList()))
            .ToDictionary(u => u.Id);

        var items = new List<CapsuleListItem>();
        foreach (var f in favs)
        {
            if (!capsuleMap.TryGetValue(f.CapsuleId, out var c)) continue;
            if (!owners.TryGetValue(c.OwnerId, out var owner)) continue;
            items.Add(_mapper.ListItem(c, owner, favoritedByMe: true, favoritedAt: f.CreatedAt));
        }
        return new Paginated<CapsuleListItem>(items, Page(total, page, pageSize));
    }

    private static string? SearchPattern(string? q)
    {
        var trimmed = q?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.EnumerateRunes().Count() > 50)
            throw ApiException.Validation("q 长度不得超过 50", "q");

        var literal = trimmed.ToLowerInvariant().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
        return $"%{literal}%";
    }

    private async Task<HashSet<Guid>> LoadFavoriteSet(Guid? viewerId, IReadOnlyList<Guid> capsuleIds)
    {
        if (viewerId is null || capsuleIds.Count == 0) return new HashSet<Guid>();
        var favs = await _favorites.FindByUserAndCapsuleIds(viewerId.Value, capsuleIds);
        return favs.Select(f => f.CapsuleId).ToHashSet();
    }

    private static int Offset(int page, int pageSize) => (page - 1) * pageSize;

    private static Pagination Page(long total, int page, int pageSize)
    {
        var totalPages = pageSize == 0 ? 0 : (int)Math.Ceiling((double)total / pageSize);
        return new Pagination(page, pageSize, total, totalPages);
    }
}
