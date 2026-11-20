using HelloTimePro.Aspnet.Config;
using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Infrastructure;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HelloTimePro.Aspnet.Tests;

public sealed class CapsuleRulesTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:;Foreign Keys=False");
    private AppDbContext _db = null!;
    private PlazaService _plaza = null!;
    private CapsuleService _capsules = null!;
    private FavoriteService _favorites = null!;

    public async Task InitializeAsync()
    {
        await _connection.OpenAsync();
        await using var schema = _connection.CreateCommand();
        schema.CommandText = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "schema.sqlite.sql"));
        await schema.ExecuteNonQueryAsync();
        schema.CommandText = "PRAGMA foreign_keys = OFF";
        await schema.ExecuteNonQueryAsync();

        var config = new AppConfig { DbDriver = "sqlite" };
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options;
        _db = new AppDbContext(options, config);
        var capsuleRepository = new CapsuleRepository(_db, config);
        var userRepository = new UserRepository(_db);
        var favoriteRepository = new FavoriteRepository(_db);
        var mapper = new MapperService();
        _plaza = new PlazaService(capsuleRepository, userRepository, favoriteRepository, mapper);
        _capsules = new CapsuleService(_db, capsuleRepository, userRepository, favoriteRepository, mapper);
        _favorites = new FavoriteService(_db, capsuleRepository, favoriteRepository);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task PlazaStatsSharesLiteralSearchAndKeepsGlobalOpenTimes()
    {
        Assert.Equal(new PlazaStats(new PlazaCounts(0, 0, 0), null, null), await _plaza.PlazaStats(null));
        var alice = await AddUser("Writer_One");
        var bob = await AddUser("WriterXOne");
        var now = DateTimeOffset.FromUnixTimeSeconds(Times.NowUtc().ToUnixTimeSeconds());
        var opened = now.AddHours(-1);
        _db.Capsules.Add(new Capsule
        {
            Id = Guid.NewGuid(), OwnerId = alice.Id, Code = "OPEN0001", Title = "Report%_\\",
            Content = "test", InPlaza = true, CreatedAt = opened.AddHours(-1), UpdatedAt = opened.AddHours(-1),
            OpenAt = opened,
        });
        await _db.SaveChangesAsync();
        var next = now.AddHours(1);
        var farthest = now.AddHours(2);
        await Create(bob, "Other title", next, true);
        await Create(bob, "ReportXYZ", farthest, true);
        await Create(alice, "Report%_\\", now.AddHours(3), false);

        foreach (var search in new[] { "  REPORT%_\\  ", "\\", "%", "_", "WRITER_ONE" })
        {
            var stats = await _plaza.PlazaStats(search);
            Assert.Equal(new PlazaStats(new PlazaCounts(1, 1, 0), Times.Iso(farthest), Times.Iso(next)), stats);
            foreach (var (filter, expected) in new[] { ("all", 1), ("opened", 1), ("unopened", 0) })
            {
                var page = await _plaza.PlazaList("new", filter, search, 1, 20, null);
                Assert.Equal(expected, page.Pagination.Total);
                Assert.Equal(expected, page.Items.Count);
            }
        }
        var error = await Assert.ThrowsAsync<ApiException>(() => _plaza.PlazaStats(new string('字', 51)));
        Assert.Equal(ErrorCode.VALIDATION_ERROR, error.Code);
    }

    [Fact]
    public async Task PrivateAndOwnFavoritesAreCountedAndDeletedWithoutCascade()
    {
        var owner = await AddUser("Owner");
        var viewer = await AddUser("Viewer");
        var capsule = await Create(owner, "Private", Times.NowUtc().AddHours(1), false);

        var error = await Assert.ThrowsAsync<ApiException>(() => _favorites.AddFavorite(owner, "not-a-uuid"));
        Assert.Equal(ErrorCode.VALIDATION_ERROR, error.Code);
        var first = await _favorites.AddFavorite(owner, capsule.Id);
        Assert.Equal(1, first.FavoriteCount);
        Assert.Equal(first, await _favorites.AddFavorite(owner, capsule.Id));
        await _favorites.AddFavorite(viewer, capsule.Id);

        var owned = Assert.Single((await _plaza.MyCapsules(owner, 1, 20)).Items);
        Assert.True(owned.FavoritedByMe);
        Assert.Null(owned.FavoritedAt);
        var favorited = Assert.Single((await _plaza.MyFavorites(viewer, 1, 20)).Items);
        Assert.False(favorited.InPlaza);
        Assert.NotNull(favorited.FavoritedAt);
        Assert.Equal(new MyStats(1, 0, 1, 0, 2, 1), await _plaza.MyStats(owner));

        _db.ChangeTracker.Clear();
        await _capsules.DeleteOwn(owner, capsule.Id);
        Assert.False(await _db.Favorites.AnyAsync());
        Assert.Empty((await _plaza.MyFavorites(viewer, 1, 20)).Items);
        foreach (var user in new[] { owner, viewer })
            Assert.Equal(new MyStats(0, 0, 0, 0, 0, 0), await _plaza.MyStats(user));
    }

    [Fact]
    public void OpenAtUsesUtcCalendarYearsAndClampsLeapDay()
    {
        var now = new DateTimeOffset(2028, 3, 1, 1, 30, 45, TimeSpan.FromHours(8));
        var limit = new DateTimeOffset(2038, 2, 28, 17, 30, 45, TimeSpan.Zero);
        Assert.Throws<ApiException>(() => Validation.OpenAt(Times.Iso(now.AddMinutes(1)), now));
        Assert.Equal(now.ToUniversalTime().AddMinutes(1).AddTicks(1),
            Validation.OpenAt(Times.Iso(now.AddMinutes(1).AddTicks(1)), now));
        Assert.Equal(limit, Validation.OpenAt(Times.Iso(limit), now));
        Assert.Throws<ApiException>(() => Validation.OpenAt(Times.Iso(limit.AddTicks(1)), now));
    }

    private async Task<User> AddUser(string nickname)
    {
        var now = Times.NowUtc();
        var user = new User
        {
            Id = Guid.NewGuid(), Email = $"{nickname.ToLowerInvariant()}@example.test", Nickname = nickname,
            AvatarId = "neo", PasswordHash = "test", CreatedAt = now, UpdatedAt = now,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    private Task<CapsuleDetail> Create(User owner, string title, DateTimeOffset openAt, bool inPlaza) =>
        _capsules.Create(owner, new CreateCapsuleRequest(title, "test", Times.Iso(openAt), inPlaza));
}
