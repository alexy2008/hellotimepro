#include "validation.h"

#include <regex>

#include "api_error.h"
#include "iso_date.h"

namespace validation
{
namespace
{
std::string trim(const std::string &s)
{
    const auto begin = s.find_first_not_of(" \t\r\n");
    const auto end = s.find_last_not_of(" \t\r\n");
    if (begin == std::string::npos)
        return "";
    return s.substr(begin, end - begin + 1);
}

const std::regex &emailRe()
{
    static const std::regex re(R"(^[^@\s]+@[^@\s]+\.[^@\s]+$)");
    return re;
}

const std::regex &avatarRe()
{
    static const std::regex re("^[a-z0-9-]{2,20}$");
    return re;
}

const std::regex &codeRe()
{
    static const std::regex re("^[A-Za-z0-9]{8}$");
    return re;
}
}  // namespace

size_t codepointCount(const std::string &s)
{
    size_t count = 0;
    for (unsigned char c : s)
        if ((c & 0xC0) != 0x80)  // 非延续字节
            ++count;
    return count;
}

std::string email(const std::optional<std::string> &value)
{
    const std::string e = trim(value.value_or(""));
    if (e.empty() || e.size() > 254 || !std::regex_match(e, emailRe()))
        throw ApiError::validation("邮箱格式不正确", "email");
    return e;
}

std::string requireNonBlank(const std::optional<std::string> &value, const std::string &field)
{
    if (!value || trim(*value).empty())
        throw ApiError::validation(field + " 不能为空", field);
    return *value;
}

std::string password(const std::optional<std::string> &value, const std::string &field)
{
    const std::string v = value.value_or("");
    const size_t len = codepointCount(v);
    bool hasLetter = false;
    bool hasDigit = false;
    for (char c : v)
    {
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'))
            hasLetter = true;
        else if (c >= '0' && c <= '9')
            hasDigit = true;
    }
    if (len < 8 || len > 128 || !hasLetter || !hasDigit)
        throw ApiError::validation("密码至少 8 位且需包含字母和数字", field);
    return v;
}

std::string nickname(const std::optional<std::string> &value)
{
    const auto fail = [] {
        return ApiError::validation("昵称需为 2-20 位字母/数字/下划线/连字符", "nickname");
    };
    if (!value)
        throw fail();
    const std::string &v = *value;
    const size_t len = codepointCount(v);
    if (len < 2 || len > 20)
        throw fail();
    for (unsigned char c : v)
    {
        if (c >= 0x80)
            continue;  // 非 ASCII 码点放行（CJK 等）
        const bool ok = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                        (c >= '0' && c <= '9') || c == '_' || c == '-';
        if (!ok)
            throw fail();
    }
    return v;
}

std::string avatarFormat(const std::optional<std::string> &value)
{
    if (!value || !std::regex_match(*value, avatarRe()))
        throw ApiError::validation("头像 ID 格式不正确", "avatarId");
    return *value;
}

std::string title(const std::optional<std::string> &value)
{
    if (!value || value->empty() || codepointCount(*value) > 60)
        throw ApiError::validation("标题长度需为 1-60", "title");
    return *value;
}

std::string content(const std::optional<std::string> &value)
{
    if (!value || value->empty() || codepointCount(*value) > 5000)
        throw ApiError::validation("内容长度需为 1-5000", "content");
    return *value;
}

int64_t openAt(const std::optional<std::string> &value)
{
    if (!value || value->empty())
        throw ApiError::validation("openAt 不能为空", "openAt");
    const auto t = iso_date::parse(*value);
    if (!t)
        throw ApiError::validation("openAt 必须是 ISO-8601 时间", "openAt");
    return *t;
}

void code(const std::string &value)
{
    if (!std::regex_match(value, codeRe()))
        throw ApiError::validation("code 必须为 8 位字母数字", "code");
}

void page(int64_t page, int64_t pageSize)
{
    if (page < 1)
        throw ApiError::validation("page 必须 >= 1", "page");
    if (pageSize < 1 || pageSize > 50)
        throw ApiError::validation("pageSize 范围 1-50", "pageSize");
}
}  // namespace validation
