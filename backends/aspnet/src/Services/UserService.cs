using HelloTimePro.Aspnet.Domain;
using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Infrastructure;
using HelloTimePro.Aspnet.Repositories;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

public sealed class UserService
{
    private readonly AppDbContext _db;
    private readonly UserRepository _users;
    private readonly AvatarService _avatars;
    private readonly MapperService _mapper;

    public UserService(AppDbContext db, UserRepository users, AvatarService avatars, MapperService mapper)
    {
        _db = db;
        _users = users;
        _avatars = avatars;
        _mapper = mapper;
    }

    public UserDto ToDto(User user) => _mapper.User(user);

    public async Task<UserDto> UpdateProfile(User user, UpdateProfileRequest req)
    {
        if (req.Nickname is null && req.AvatarId is null)
            throw ApiException.Validation("至少提供一个字段", "body");

        var newNickname = req.Nickname is null ? null : Validation.Nickname(req.Nickname);
        var newAvatar = req.AvatarId is null ? null : Validation.AvatarFormat(req.AvatarId);

        if (newNickname is not null && newNickname != user.Nickname)
        {
            if (await _users.ExistsByNickname(newNickname))
                throw ApiException.Conflict("昵称已被使用", "nickname");
            user.Nickname = newNickname;
        }
        if (newAvatar is not null)
        {
            if (!_avatars.Exists(newAvatar))
                throw ApiException.Validation("头像 ID 不存在", "avatarId");
            user.AvatarId = newAvatar;
        }
        user.UpdatedAt = Times.NowUtc();
        await _db.SaveChangesAsync();
        return _mapper.User(user);
    }
}
