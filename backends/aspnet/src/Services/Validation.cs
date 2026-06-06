using System.Globalization;
using System.Text.RegularExpressions;
using HelloTimePro.Aspnet.Web;

namespace HelloTimePro.Aspnet.Services;

/// <summary>
/// 手写字段校验（不使用 DataAnnotations / [ApiController] 自动 400，以输出契约约定的 422 外壳）。
/// 失败统一抛 VALIDATION_ERROR → 422，正则/长度约束与 spec/openapi.yaml 一致。
/// </summary>
public static partial class Validation
{
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRe();

    [GeneratedRegex(@"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")]
    private static partial Regex PasswordRe();

    [GeneratedRegex(@"^[\p{L}\p{N}_-]{2,20}$")]
    private static partial Regex NicknameRe();

    [GeneratedRegex(@"^[a-z0-9-]{2,20}$")]
    private static partial Regex AvatarRe();

    [GeneratedRegex(@"^[A-Za-z0-9]{8}$")]
    private static partial Regex CodeRe();

    public static string Email(string? value)
    {
        var e = value?.Trim() ?? "";
        if (e.Length == 0 || e.Length > 254 || !EmailRe().IsMatch(e))
            throw ApiException.Validation("邮箱格式不正确", "email");
        return e;
    }

    public static string RequireNonBlank(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw ApiException.Validation($"{field} 不能为空", field);
        return value;
    }

    public static string Password(string? value, string field = "password")
    {
        if (value is null || !PasswordRe().IsMatch(value))
            throw ApiException.Validation("密码至少 8 位且需包含字母和数字", field);
        return value;
    }

    public static string Nickname(string? value)
    {
        if (value is null || !NicknameRe().IsMatch(value))
            throw ApiException.Validation("昵称需为 2-20 位字母/数字/下划线/连字符", "nickname");
        return value;
    }

    public static string AvatarFormat(string? value)
    {
        if (value is null || !AvatarRe().IsMatch(value))
            throw ApiException.Validation("头像 ID 格式不正确", "avatarId");
        return value;
    }

    public static string Title(string? value)
    {
        if (value is null || value.Length == 0 || value.Length > 60)
            throw ApiException.Validation("标题长度需为 1-60", "title");
        return value;
    }

    public static string Content(string? value)
    {
        if (value is null || value.Length == 0 || value.Length > 5000)
            throw ApiException.Validation("内容长度需为 1-5000", "content");
        return value;
    }

    public static DateTimeOffset OpenAt(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw ApiException.Validation("openAt 不能为空", "openAt");
        if (!DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.RoundtripKind, out var dto))
            throw ApiException.Validation("openAt 必须是 ISO-8601 时间", "openAt");
        return dto;
    }

    public static string Code(string value)
    {
        if (!CodeRe().IsMatch(value))
            throw ApiException.Validation("code 必须为 8 位字母数字", "code");
        return value;
    }

    public static void Page(int page, int pageSize)
    {
        if (page < 1) throw ApiException.Validation("page 必须 >= 1", "page");
        if (pageSize < 1 || pageSize > 50) throw ApiException.Validation("pageSize 范围 1-50", "pageSize");
    }
}
