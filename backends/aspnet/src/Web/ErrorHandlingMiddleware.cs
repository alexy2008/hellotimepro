using System.Text.Json;
using HelloTimePro.Aspnet.Dto;

namespace HelloTimePro.Aspnet.Web;

/// <summary>
/// 把异常统一转换为契约约定的 <c>{ success:false, data:null, message, errorCode, details? }</c>。
/// 对应 Ktor 的 StatusPages：业务异常映射各自状态码；请求体反序列化失败 → 422 VALIDATION_ERROR；
/// 其它未捕获异常 → 500 INTERNAL_ERROR。
/// </summary>
public sealed class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _log;
    private readonly JsonSerializerOptions _json;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> log, JsonSerializerOptions json)
    {
        _next = next;
        _log = log;
        _json = json;
    }

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ApiException ex)
        {
            await Write(ctx, (int)ex.Status, new ErrorEnvelope(ex.Message, ex.Code.ToString()) { Details = ex.Details });
        }
        catch (Exception ex) when (ex is JsonException || ex is BadHttpRequestException)
        {
            // 请求体格式不合法（坏 JSON / 类型不符）→ 422 VALIDATION_ERROR。
            await Write(ctx, 422, new ErrorEnvelope("字段校验失败", ErrorCode.VALIDATION_ERROR.ToString())
            {
                Details = new[] { new ErrorDetail("body", "请求体格式不合法") },
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled error");
            await Write(ctx, 500, new ErrorEnvelope($"服务器内部错误: {ex.GetType().Name}", ErrorCode.INTERNAL_ERROR.ToString()));
        }
    }

    private async Task Write(HttpContext ctx, int status, ErrorEnvelope body)
    {
        if (ctx.Response.HasStarted)
        {
            _log.LogWarning("Response already started; cannot write error envelope");
            return;
        }
        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(body, _json));
    }
}
