#include "json_util.h"

namespace envelope
{
drogon::HttpResponsePtr ok(const Json::Value &data, drogon::HttpStatusCode status)
{
    Json::Value body(Json::objectValue);
    body["success"] = true;
    body["data"] = data;
    body["message"] = Json::nullValue;
    body["errorCode"] = Json::nullValue;
    auto resp = drogon::HttpResponse::newHttpJsonResponse(body);
    resp->setStatusCode(status);
    return resp;
}

drogon::HttpResponsePtr error(const ApiError &e)
{
    Json::Value body(Json::objectValue);
    body["success"] = false;
    body["data"] = Json::nullValue;
    body["message"] = e.message;
    body["errorCode"] = e.code;
    if (!e.details.empty())
    {
        Json::Value details(Json::arrayValue);
        for (const auto &[field, message] : e.details)
        {
            Json::Value d(Json::objectValue);
            d["field"] = field;
            d["message"] = message;
            details.append(d);
        }
        body["details"] = details;
    }
    auto resp = drogon::HttpResponse::newHttpJsonResponse(body);
    resp->setStatusCode(static_cast<drogon::HttpStatusCode>(e.status));
    return resp;
}

drogon::HttpResponsePtr noContent()
{
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    return resp;
}
}  // namespace envelope
