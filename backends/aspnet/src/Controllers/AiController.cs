using HelloTimePro.Aspnet.Dto;
using HelloTimePro.Aspnet.Services;
using HelloTimePro.Aspnet.Web;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Controllers;

[Route("api/v1")]
public sealed class AiController : ApiControllerBase
{
    private readonly CapsuleSuggestionService _suggestion;
    private readonly CapsuleRecommendationService _recommendation;

    public AiController(CapsuleSuggestionService suggestion, CapsuleRecommendationService recommendation)
    {
        _suggestion = suggestion;
        _recommendation = recommendation;
    }

    [HttpPost("capsule-suggestion")]
    public async Task<IActionResult> Suggest([FromBody] CapsuleSuggestionRequest? req)
    {
        var result = await _suggestion.Suggest(req ?? new CapsuleSuggestionRequest(null, null));
        return Wrapped(result);
    }

    [HttpGet("capsule-recommendations")]
    public async Task<IActionResult> Recommendations()
    {
        var countRaw = StringParam("count");
        int count;
        if (countRaw is not null)
        {
            if (!int.TryParse(countRaw, out var c) || c < 3 || c > 8)
                throw ApiException.Validation("count 必须是 [3, 8] 范围内的整数", "count");
            count = c;
        }
        else
        {
            count = 4;
        }
        var locale = StringParam("locale") ?? "zh-CN";
        return Wrapped(await _recommendation.GetRecommendations(count, locale));
    }
}
