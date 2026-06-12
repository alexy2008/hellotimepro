#include "llm_client.h"

#include <drogon/HttpClient.h>
#include <trantor/utils/Logger.h>

#include <chrono>

namespace
{
std::string compactJson(const Json::Value &v)
{
    Json::StreamWriterBuilder builder;
    builder["indentation"] = "";
    return Json::writeString(builder, v);
}

// base_url 拆为 origin（scheme://host:port，给 HttpClient）+ path 前缀。
struct BaseUrl
{
    std::string origin;
    std::string pathPrefix;
};

BaseUrl splitBaseUrl(const std::string &raw)
{
    std::string url = raw;
    // trim + 去尾部斜杠
    while (!url.empty() && (url.back() == '/' || url.back() == ' '))
        url.pop_back();
    if (url.empty())
        url = "https://api.openai.com/v1";
    const auto schemeEnd = url.find("://");
    if (schemeEnd == std::string::npos)
        return {"https://" + url, ""};
    const auto pathStart = url.find('/', schemeEnd + 3);
    if (pathStart == std::string::npos)
        return {url, ""};
    return {url.substr(0, pathStart), url.substr(pathStart)};
}

std::string extractTokens(const Json::Value &body)
{
    if (!body.isMember("usage") || !body["usage"].isObject())
        return "n/a";
    const auto &usage = body["usage"];
    int64_t total = 0;
    if (LlmClient::valueAsInt(usage["total_tokens"], total) && total > 0)
        return std::to_string(total);
    int64_t input = 0, output = 0;
    LlmClient::valueAsInt(usage["input_tokens"], input);
    LlmClient::valueAsInt(usage["output_tokens"], output);
    if (input + output > 0)
        return std::to_string(input + output);
    return "n/a";
}

std::string extractChatText(const Json::Value &body)
{
    const auto &choices = body["choices"];
    if (choices.isArray() && !choices.empty())
    {
        const auto &content = choices[0]["message"]["content"];
        if (content.isString() && !content.asString().empty())
            return content.asString();
    }
    throw LlmError("LLM chat response missing content");
}

std::string extractResponsesText(const Json::Value &body)
{
    if (body["output_text"].isString() && !body["output_text"].asString().empty())
        return body["output_text"].asString();
    if (body["output"].isArray())
    {
        for (const auto &item : body["output"])
        {
            if (!item["content"].isArray())
                continue;
            for (const auto &entry : item["content"])
                if (entry["text"].isString() && !entry["text"].asString().empty())
                    return entry["text"].asString();
        }
    }
    throw LlmError("LLM response did not contain output text");
}
}  // namespace

drogon::Task<Json::Value> LlmClient::generateCapsuleSuggestion(std::string prompt)
{
    co_return co_await generateStructuredJson(std::move(prompt), suggestionSpec());
}

drogon::Task<Json::Value> LlmClient::generateCapsuleRecommendations(std::string prompt)
{
    co_return co_await generateStructuredJson(std::move(prompt), recommendationSpec());
}

drogon::Task<Json::Value> LlmClient::generateStructuredJson(std::string prompt,
                                                            const SchemaSpec &spec)
{
    if (!config_.enabled || config_.apiKey.empty())
        throw LlmError("LLM is disabled or missing API key");
    if (config_.apiStyle == "responses")
        co_return co_await generateWithResponses(std::move(prompt), spec);
    if (config_.apiStyle == "auto")
    {
        // C++ 协程不允许在 catch 块里 co_await：先记失败，try 外再回落 chat。
        bool fallbackToChat = false;
        Json::Value result;
        try
        {
            result = co_await generateWithResponses(prompt, spec);
        }
        catch (const LlmError &e)
        {
            LOG_INFO << "Responses API unavailable (" << e.what()
                     << "); falling back to chat completions";
            fallbackToChat = true;
        }
        if (!fallbackToChat)
            co_return result;
    }
    co_return co_await generateWithChat(std::move(prompt), spec, true);
}

drogon::Task<Json::Value> LlmClient::generateWithResponses(std::string prompt,
                                                           const SchemaSpec &spec)
{
    Json::Value format(Json::objectValue);
    format["type"] = "json_schema";
    format["name"] = spec.schemaName;
    format["strict"] = true;
    format["schema"] = spec.schema;
    Json::Value text(Json::objectValue);
    text["format"] = format;

    Json::Value payload(Json::objectValue);
    payload["model"] = config_.model;
    payload["input"] = prompt;
    payload["max_output_tokens"] = spec.maxOutputTokens;
    payload["text"] = text;

    const Json::Value body = co_await postJson("/responses", payload);
    co_return parseJsonObject(extractResponsesText(body));
}

drogon::Task<Json::Value> LlmClient::generateWithChat(std::string prompt,
                                                      const SchemaSpec &spec,
                                                      bool disableThinking)
{
    const auto buildPayload = [&](bool withThinking) {
        Json::Value messages(Json::arrayValue);
        Json::Value sys(Json::objectValue);
        sys["role"] = "system";
        sys["content"] = spec.systemPrompt;
        Json::Value usr(Json::objectValue);
        usr["role"] = "user";
        usr["content"] = prompt;
        messages.append(sys);
        messages.append(usr);

        Json::Value payload(Json::objectValue);
        payload["model"] = config_.model;
        payload["messages"] = messages;
        payload["max_tokens"] = spec.maxTokens;
        if (withThinking)
        {
            Json::Value thinking(Json::objectValue);
            thinking["type"] = "disabled";
            payload["thinking"] = thinking;
        }
        return payload;
    };

    // 某些网关不认 thinking 字段：400 时去掉重试一次（co_await 须在 catch 外）。
    bool retryWithoutThinking = false;
    Json::Value body;
    try
    {
        body = co_await postJson("/chat/completions", buildPayload(disableThinking));
    }
    catch (const LlmError &e)
    {
        if (e.status == 400 && disableThinking)
            retryWithoutThinking = true;
        else
            throw;
    }
    if (retryWithoutThinking)
        body = co_await postJson("/chat/completions", buildPayload(false));
    co_return parseJsonObject(extractChatText(body));
}

// 向 path POST JSON；瞬时网络/TLS 错误按配置重试，HTTP 4xx/5xx 与坏 JSON 不重试。
drogon::Task<Json::Value> LlmClient::postJson(std::string path, Json::Value payload)
{
    const BaseUrl base = splitBaseUrl(config_.baseUrl);
    const std::string url = base.origin + base.pathPrefix + path;
    const std::string bodyStr = compactJson(payload);
    const int attempts = std::max(1, config_.maxRetries + 1);
    std::string lastError = "LLM request failed";

    for (int attempt = 1; attempt <= attempts; ++attempt)
    {
        LOG_INFO << "LLM request  model=" << config_.model << " url=" << url
                 << " attempt=" << attempt << "/" << attempts;
        const auto start = std::chrono::steady_clock::now();
        const auto elapsedMs = [&start] {
            return std::chrono::duration_cast<std::chrono::milliseconds>(
                       std::chrono::steady_clock::now() - start)
                .count();
        };
        try
        {
            auto client = drogon::HttpClient::newHttpClient(base.origin);
            auto req = drogon::HttpRequest::newHttpRequest();
            req->setMethod(drogon::Post);
            req->setPath(base.pathPrefix + path);
            req->addHeader("Authorization", "Bearer " + config_.apiKey);
            req->addHeader("Accept", "application/json");
            req->addHeader("User-Agent", config_.userAgent);
            req->setContentTypeCode(drogon::CT_APPLICATION_JSON);
            req->setBody(bodyStr);

            const auto resp = co_await client->sendRequestCoro(
                req, static_cast<double>(config_.timeoutMs) / 1000.0);
            const int status = static_cast<int>(resp->statusCode());
            if (status < 200 || status >= 300)
            {
                LOG_WARN << "LLM error    model=" << config_.model
                         << " elapsed_ms=" << elapsedMs() << " status=" << status;
                const std::string text(resp->body());
                throw LlmError("HTTP " + std::to_string(status) + ": " + text.substr(0, 500),
                               status);
            }
            Json::Value parsed;
            Json::CharReaderBuilder builder;
            std::string errs;
            const std::unique_ptr<Json::CharReader> reader(builder.newCharReader());
            const auto body = resp->body();
            if (!reader->parse(body.data(), body.data() + body.size(), &parsed, &errs) ||
                !parsed.isObject())
            {
                LOG_WARN << "LLM error    model=" << config_.model
                         << " elapsed_ms=" << elapsedMs() << " error=invalid-json";
                throw LlmError("LLM response was not valid JSON");
            }
            LOG_INFO << "LLM response model=" << config_.model
                     << " elapsed_ms=" << elapsedMs() << " tokens=" << extractTokens(parsed);
            co_return parsed;
        }
        catch (const LlmError &)
        {
            throw;  // HTTP 状态错误/坏 JSON 不重试
        }
        catch (const std::exception &e)
        {
            const bool willRetry = attempt < attempts;
            LOG_WARN << "LLM error    model=" << config_.model
                     << " elapsed_ms=" << elapsedMs() << " error=" << e.what()
                     << (willRetry ? " (will retry)" : "");
            lastError = e.what();
        }
        // 退避在 catch 外（协程限制），仅瞬时传输错误会走到这里。
        if (attempt < attempts)
            co_await drogon::sleepCoro(
                trantor::EventLoop::getEventLoopOfCurrentThread(),
                static_cast<double>(config_.retryBackoffMs * attempt) / 1000.0);
    }
    throw LlmError(lastError);
}

Json::Value LlmClient::parseJsonObject(const std::string &raw)
{
    std::string text = raw;
    // trim
    while (!text.empty() && (text.front() == ' ' || text.front() == '\n' ||
                             text.front() == '\r' || text.front() == '\t'))
        text.erase(text.begin());
    while (!text.empty() && (text.back() == ' ' || text.back() == '\n' ||
                             text.back() == '\r' || text.back() == '\t'))
        text.pop_back();
    // 剥 ``` 围栏
    if (text.rfind("```", 0) == 0)
    {
        auto firstNewline = text.find('\n');
        if (firstNewline != std::string::npos)
            text = text.substr(firstNewline + 1);
        if (text.size() >= 3 && text.compare(text.size() - 3, 3, "```") == 0)
            text = text.substr(0, text.size() - 3);
    }

    const auto tryParse = [](const std::string &s, Json::Value &out) {
        Json::CharReaderBuilder builder;
        std::string errs;
        const std::unique_ptr<Json::CharReader> reader(builder.newCharReader());
        return reader->parse(s.data(), s.data() + s.size(), &out, &errs) && out.isObject();
    };

    Json::Value parsed;
    if (tryParse(text, parsed))
        return parsed;
    const auto start = text.find('{');
    const auto end = text.rfind('}');
    if (start == std::string::npos || end == std::string::npos || start >= end)
        throw LlmError("LLM output was not valid JSON");
    if (!tryParse(text.substr(start, end - start + 1), parsed))
        throw LlmError("LLM output was not valid JSON");
    return parsed;
}

bool LlmClient::valueAsInt(const Json::Value &v, int64_t &out)
{
    if (v.isIntegral())
    {
        out = v.asInt64();
        return true;
    }
    if (v.isDouble())
    {
        out = static_cast<int64_t>(v.asDouble());
        return true;
    }
    return false;
}

// ── 结构化输出 schema ───────────────────────────────────────────────────────

const LlmClient::SchemaSpec &LlmClient::suggestionSpec()
{
    static const SchemaSpec spec = [] {
        Json::Value schema(Json::objectValue);
        schema["type"] = "object";
        schema["additionalProperties"] = false;
        Json::Value required(Json::arrayValue);
        required.append("title");
        required.append("content");
        required.append("openInDays");
        schema["required"] = required;
        Json::Value props(Json::objectValue);
        Json::Value strType(Json::objectValue);
        strType["type"] = "string";
        props["title"] = strType;
        props["content"] = strType;
        Json::Value days(Json::objectValue);
        days["type"] = "integer";
        days["minimum"] = 1;
        days["maximum"] = 3650;
        props["openInDays"] = days;
        schema["properties"] = props;
        return SchemaSpec{
            "capsule_suggestion", schema,
            "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
            "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。"
            "若用户已给出标题，title 可原样回填。",
            900, 900};
    }();
    return spec;
}

const LlmClient::SchemaSpec &LlmClient::recommendationSpec()
{
    static const SchemaSpec spec = [] {
        Json::Value itemSchema(Json::objectValue);
        itemSchema["type"] = "object";
        itemSchema["additionalProperties"] = false;
        Json::Value itemRequired(Json::arrayValue);
        itemRequired.append("title");
        itemRequired.append("hint");
        itemRequired.append("openInDays");
        itemSchema["required"] = itemRequired;
        Json::Value itemProps(Json::objectValue);
        Json::Value strType(Json::objectValue);
        strType["type"] = "string";
        itemProps["title"] = strType;
        itemProps["hint"] = strType;
        Json::Value days(Json::objectValue);
        days["type"] = "integer";
        days["minimum"] = 1;
        days["maximum"] = 3650;
        itemProps["openInDays"] = days;
        itemSchema["properties"] = itemProps;

        Json::Value items(Json::objectValue);
        items["type"] = "array";
        items["minItems"] = 3;
        items["maxItems"] = 8;
        items["items"] = itemSchema;

        Json::Value schema(Json::objectValue);
        schema["type"] = "object";
        schema["additionalProperties"] = false;
        Json::Value required(Json::arrayValue);
        required.append("items");
        schema["required"] = required;
        Json::Value props(Json::objectValue);
        props["items"] = items;
        schema["properties"] = props;
        return SchemaSpec{
            "capsule_recommendations", schema,
            "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
            "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
            900, 900};
    }();
    return spec;
}
