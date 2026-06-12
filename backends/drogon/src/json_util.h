#pragma once

#include <drogon/HttpResponse.h>
#include <json/json.h>

#include "api_error.h"

// 统一响应外壳 `{ success, data, message, errorCode }`。
// jsoncpp 的 Json::nullValue 序列化为显式 null，满足契约 strict equal 断言。
namespace envelope
{
drogon::HttpResponsePtr ok(const Json::Value &data,
                           drogon::HttpStatusCode status = drogon::k200OK);
drogon::HttpResponsePtr error(const ApiError &e);
drogon::HttpResponsePtr noContent();
}  // namespace envelope
