#pragma once

#include <string>
#include <utility>
#include <vector>

// 业务异常：handler 经 guarded() 统一转换为契约约定的 ErrorEnvelope + HTTP 状态码。
// 对应 Axum 的 ApiError。
struct ApiError
{
    int status;
    std::string code;
    std::string message;
    std::vector<std::pair<std::string, std::string>> details;  // 空 = 不输出

    static ApiError validation(const std::string &message, const std::string &field)
    {
        return {422, "VALIDATION_ERROR", message, {{field, message}}};
    }

    static ApiError unauthorized(const std::string &message)
    {
        return {401, "UNAUTHORIZED", message, {}};
    }

    static ApiError forbidden(const std::string &message)
    {
        return {403, "FORBIDDEN", message, {}};
    }

    static ApiError notFound(const std::string &message)
    {
        return {404, "NOT_FOUND", message, {}};
    }

    static ApiError conflict(const std::string &message, const std::string &field)
    {
        return {409, "CONFLICT", message, {{field, message}}};
    }

    static ApiError badRequest(const std::string &message)
    {
        return {400, "BAD_REQUEST", message, {}};
    }

    static ApiError rateLimited(const std::string &message)
    {
        return {429, "RATE_LIMITED", message, {}};
    }

    static ApiError internal(const std::string &message)
    {
        return {500, "INTERNAL_ERROR", message, {}};
    }

    // 请求体反序列化失败（坏 JSON）→ 422 VALIDATION_ERROR。
    static ApiError invalidBody()
    {
        return {422, "VALIDATION_ERROR", "字段校验失败", {{"body", "请求体格式不合法"}}};
    }
};
