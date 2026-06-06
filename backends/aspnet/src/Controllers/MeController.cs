using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Controllers;

[Route("api/v1/me")]
public sealed class MeController : ApiControllerBase
{
    private readonly AuthContext _authContext;
    private readonly AuthService _auth;
    private readonly UserService _userService;
    private readonly PlazaService _plaza;
    private readonly CapsuleService _capsules;
    private readonly FavoriteService _favorites;

    public MeController(
        AuthContext authContext, AuthService auth, UserService userService,
        PlazaService plaza, CapsuleService capsules, FavoriteService favorites)
    {
        _authContext = authContext;
        _auth = auth;
        _userService = userService;
        _plaza = plaza;
        _capsules = capsules;
        _favorites = favorites;
    }

    [HttpGet]
    public async Task<IActionResult> Me()
    {
        var user = await _authContext.Required(AuthHeader);
        return Wrapped(_userService.ToDto(user));
    }

    [HttpPatch]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest? req)
    {
        var user = await _authContext.Required(AuthHeader);
        var dto = await _userService.UpdateProfile(user, req ?? new UpdateProfileRequest(null, null));
        return Wrapped(dto);
    }

    [HttpPost("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest? req)
    {
        var user = await _authContext.Required(AuthHeader);
        await _auth.ChangePassword(user, req ?? new ChangePasswordRequest(null, null));
        return StatusCode(StatusCodes.Status204NoContent);
    }

    [HttpGet("capsules")]
    public async Task<IActionResult> MyCapsules()
    {
        var user = await _authContext.Required(AuthHeader);
        return Wrapped(await _plaza.MyCapsules(user, Page, PageSize));
    }

    [HttpDelete("capsules/{id}")]
    public async Task<IActionResult> DeleteCapsule(string id)
    {
        var user = await _authContext.Required(AuthHeader);
        await _capsules.DeleteOwn(user, id);
        return StatusCode(StatusCodes.Status204NoContent);
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> MyFavorites()
    {
        var user = await _authContext.Required(AuthHeader);
        return Wrapped(await _plaza.MyFavorites(user, Page, PageSize));
    }

    [HttpPost("favorites")]
    public async Task<IActionResult> AddFavorite([FromBody] FavoriteRequest? req)
    {
        var user = await _authContext.Required(AuthHeader);
        return Wrapped(await _favorites.AddFavorite(user, req?.CapsuleId));
    }

    [HttpDelete("favorites/{capsuleId}")]
    public async Task<IActionResult> RemoveFavorite(string capsuleId)
    {
        var user = await _authContext.Required(AuthHeader);
        await _favorites.RemoveFavorite(user, capsuleId);
        return StatusCode(StatusCodes.Status204NoContent);
    }
}
