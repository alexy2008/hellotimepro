using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Controllers;

[Route("api/v1")]
public sealed class AvatarsController : ApiControllerBase
{
    private readonly AvatarService _avatars;
    public AvatarsController(AvatarService avatars) => _avatars = avatars;

    [HttpGet("avatars")]
    public IActionResult List() => Wrapped(_avatars.List());
}
