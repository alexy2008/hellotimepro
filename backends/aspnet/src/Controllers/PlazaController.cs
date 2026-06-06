using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Controllers;

[Route("api/v1/plaza/capsules")]
public sealed class PlazaController : ApiControllerBase
{
    private readonly AuthContext _authContext;
    private readonly PlazaService _plaza;
    private readonly CapsuleService _capsules;

    public PlazaController(AuthContext authContext, PlazaService plaza, CapsuleService capsules)
    {
        _authContext = authContext;
        _plaza = plaza;
        _capsules = capsules;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var viewer = await _authContext.Optional(AuthHeader);
        var sort = StringParam("sort") ?? "new";
        var filter = StringParam("filter") ?? "all";
        var q = StringParam("q");
        return Wrapped(await _plaza.PlazaList(sort, filter, q, Page, PageSize, viewer?.Id));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Detail(string id)
    {
        var viewer = await _authContext.Optional(AuthHeader);
        return Wrapped(await _capsules.GetPlazaDetail(id, viewer?.Id));
    }
}
