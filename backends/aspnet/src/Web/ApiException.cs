using System.Net;
using HelloTimePro.Aspnet.Dto;

namespace HelloTimePro.Aspnet.Web;

public enum ErrorCode
{
    VALIDATION_ERROR,
    UNAUTHORIZED,
    FORBIDDEN,
    NOT_FOUND,
    CONFLICT,
    RATE_LIMITED,
    BAD_REQUEST,
    INTERNAL_ERROR,
}

/// <summary>业务异常：由 <see cref="ErrorHandlingMiddleware"/> 统一转换为契约约定的 ErrorEnvelope + HTTP 状态码。</summary>
public sealed class ApiException : Exception
{
    public ErrorCode Code { get; }
    public HttpStatusCode Status { get; }
    public IReadOnlyList<ErrorDetail>? Details { get; }

    public ApiException(ErrorCode code, string message, HttpStatusCode status, IReadOnlyList<ErrorDetail>? details = null)
        : base(message)
    {
        Code = code;
        Status = status;
        Details = details;
    }

    public static ApiException Validation(string message, string field) => new(
        ErrorCode.VALIDATION_ERROR, message, HttpStatusCode.UnprocessableEntity,
        new[] { new ErrorDetail(field, message) });

    public static ApiException Unauthorized(string message) =>
        new(ErrorCode.UNAUTHORIZED, message, HttpStatusCode.Unauthorized);

    public static ApiException Forbidden(string message) =>
        new(ErrorCode.FORBIDDEN, message, HttpStatusCode.Forbidden);

    public static ApiException NotFound(string message) =>
        new(ErrorCode.NOT_FOUND, message, HttpStatusCode.NotFound);

    public static ApiException Conflict(string message, string? field) => new(
        ErrorCode.CONFLICT, message, HttpStatusCode.Conflict,
        field is null ? null : new[] { new ErrorDetail(field, message) });

    public static ApiException BadRequest(string message) =>
        new(ErrorCode.BAD_REQUEST, message, HttpStatusCode.BadRequest);

    public static ApiException RateLimited(string message) =>
        new(ErrorCode.RATE_LIMITED, message, (HttpStatusCode)429);
}
