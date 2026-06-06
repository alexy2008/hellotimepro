using HelloTimePro.Aspnet.Dto;
using Microsoft.AspNetCore.Mvc;

namespace HelloTimePro.Aspnet.Web;

/// <summary>控制器基类：统一成功响应外壳、Authorization 头读取、query 参数解析。</summary>
[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    /// <summary>统一成功响应：<c>{ success:true, data, message:null, errorCode:null }</c>。</summary>
    protected ObjectResult Wrapped<T>(T data, int status = StatusCodes.Status200OK) =>
        new(Envelope<T>.Ok(data)) { StatusCode = status };

    protected string? AuthHeader
    {
        get
        {
            var raw = Request.Headers.Authorization.ToString();
            return string.IsNullOrEmpty(raw) ? null : raw;
        }
    }

    // 缺失才用默认值；存在但非整数 → 422（对齐 openapi 的 integer 约束）。
    protected int IntParam(string name, int @default)
    {
        var raw = Request.Query[name].ToString();
        if (string.IsNullOrEmpty(raw)) return @default;
        if (!int.TryParse(raw, out var value))
            throw ApiException.Validation($"{name} 必须是整数", name);
        return value;
    }

    protected string? StringParam(string name)
    {
        var raw = Request.Query[name].ToString();
        return string.IsNullOrEmpty(raw) ? null : raw;
    }

    protected int Page => IntParam("page", 1);
    protected int PageSize => IntParam("pageSize", 20);
}
