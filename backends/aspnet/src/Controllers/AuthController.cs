using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Controllers;

[Route("api/v1/auth")]
public sealed class AuthController : ApiControllerBase
{
    private readonly AuthService _auth;
    public AuthController(AuthService auth) => _auth = auth;

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest? req)
    {
        var tokens = await _auth.Register(req ?? new RegisterRequest(null, null, null, null));
        return Wrapped(tokens, StatusCodes.Status201Created);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest? req)
    {
        var tokens = await _auth.Login(req ?? new LoginRequest(null, null));
        return Wrapped(tokens);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? req)
    {
        var tokens = await _auth.Refresh(req?.RefreshToken);
        return Wrapped(tokens);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest? req)
    {
        await _auth.Logout(req?.RefreshToken);
        return StatusCode(StatusCodes.Status204NoContent);
    }
}
