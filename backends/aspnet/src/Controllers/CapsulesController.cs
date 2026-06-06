using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Controllers;

[Route("api/v1/capsules")]
public sealed class CapsulesController : ApiControllerBase
{
    private readonly AuthContext _authContext;
    private readonly CapsuleService _capsules;

    public CapsulesController(AuthContext authContext, CapsuleService capsules)
    {
        _authContext = authContext;
        _capsules = capsules;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCapsuleRequest? req)
    {
        var user = await _authContext.Required(AuthHeader);
        var detail = await _capsules.Create(user, req ?? new CreateCapsuleRequest(null, null, null, null));
        return Wrapped(detail, StatusCodes.Status201Created);
    }

    [HttpGet("{code}")]
    public async Task<IActionResult> GetByCode(string code)
    {
        var viewer = await _authContext.Optional(AuthHeader);
        return Wrapped(await _capsules.GetByCode(code, viewer?.Id));
    }
}
