using System.Security.Cryptography;
using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Infrastructure;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

public sealed class CapsuleService
{
    private const string CodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private readonly AppDbContext _db;
    private readonly CapsuleRepository _capsules;
    private readonly UserRepository _users;
    private readonly FavoriteRepository _favorites;
    private readonly MapperService _mapper;

    public CapsuleService(
        AppDbContext db, CapsuleRepository capsules, UserRepository users,
        FavoriteRepository favorites, MapperService mapper)
    {
        _db = db;
        _capsules = capsules;
        _users = users;
        _favorites = favorites;
        _mapper = mapper;
    }

    public async Task<CapsuleDetail> Create(User owner, CreateCapsuleRequest req)
    {
        var title = Validation.Title(req.Title);
        var content = Validation.Content(req.Content);
        var openAt = Validation.OpenAt(req.OpenAt).ToUniversalTime();
        var now = Times.NowUtc();
        if (openAt < now.AddSeconds(60))
            throw ApiException.Validation("openAt 必须晚于当前时间 60 秒以上", "openAt");
        if (openAt > now.AddYears(10))
            throw ApiException.Validation("openAt 不得超出当前时间 10 年", "openAt");
        var inPlaza = req.InPlaza ?? true;

        var code = await GenerateUniqueCode();
        var capsule = new Capsule
        {
            Id = Guid.NewGuid(),
            OwnerId = owner.Id,
            Code = code,
            Title = title,
            Content = content,
            OpenAt = openAt,
            InPlaza = inPlaza,
            FavoriteCount = 0,
            CreatedAt = now,
            UpdatedAt = now,
        };
        _capsules.Add(capsule);
        await _db.SaveChangesAsync();
        return _mapper.Detail(capsule, owner, favoritedByMe: false, includeContent: true);
    }

    public async Task<CapsuleDetail> GetByCode(string code, Guid? viewerId)
    {
        Validation.Code(code);
        var capsule = await _capsules.FindByCode(code.ToUpperInvariant())
                      ?? throw ApiException.NotFound("胶囊不存在");
        var owner = await _users.FindById(capsule.OwnerId) ?? throw ApiException.NotFound("胶囊不存在");
        var favorited = viewerId is not null && await _favorites.Exists(viewerId.Value, capsule.Id);
        return _mapper.Detail(capsule, owner, favorited, includeContent: true);
    }

    public async Task<CapsuleDetail> GetPlazaDetail(string idRaw, Guid? viewerId)
    {
        var id = Times.ParseUuidOrNull(idRaw) ?? throw ApiException.NotFound("胶囊不存在");
        var capsule = await _capsules.FindById(id);
        if (capsule is null || !capsule.InPlaza) throw ApiException.NotFound("胶囊不存在");
        var owner = await _users.FindById(capsule.OwnerId) ?? throw ApiException.NotFound("胶囊不存在");
        var favorited = viewerId is not null && await _favorites.Exists(viewerId.Value, capsule.Id);
        return _mapper.Detail(capsule, owner, favorited, includeContent: true);
    }

    public async Task DeleteOwn(User user, string idRaw)
    {
        var id = Times.ParseUuidOrNull(idRaw) ?? throw ApiException.NotFound("胶囊不存在");
        await using var tx = await _db.Database.BeginTransactionAsync();
        var capsule = await _capsules.FindById(id) ?? throw ApiException.NotFound("胶囊不存在");
        if (capsule.OwnerId != user.Id) throw ApiException.Forbidden("无权删除他人胶囊");
        await _favorites.DeleteByCapsule(id);
        _capsules.Remove(capsule);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    private async Task<string> GenerateUniqueCode()
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var candidate = GenerateCode();
            if (!await _capsules.ExistsByCode(candidate)) return candidate;
        }
        throw new InvalidOperationException("生成唯一码失败");
    }

    private static string GenerateCode()
    {
        Span<char> buf = stackalloc char[8];
        for (var i = 0; i < 8; i++)
        {
            buf[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        }
        return new string(buf);
    }
}
