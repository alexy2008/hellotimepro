// 纯函数层单元测试（无需数据库/网络）。普通 assert 风格，与 v1 一致不引测试框架。
// 契约行为由 verification/contract 黑盒覆盖。

#include <cassert>
#include <functional>
#include <iostream>
#include <string>

#include "api_error.h"
#include "config.h"
#include "db.h"
#include "iso_date.h"
#include "llm_client.h"
#include "mapper.h"
#include "recommendation_service.h"
#include "security.h"
#include "services.h"
#include "suggestion_service.h"
#include "validation.h"

namespace
{
int passed = 0;

void check(bool cond, const char *name)
{
    if (!cond)
    {
        std::cerr << "FAIL: " << name << std::endl;
        std::exit(1);
    }
    ++passed;
    std::cout << "ok " << name << std::endl;
}

bool throwsValidation(const std::function<void()> &f)
{
    try
    {
        f();
        return false;
    }
    catch (const ApiError &e)
    {
        return e.status == 422;
    }
}
}  // namespace

int main()
{
    // ── iso_date ────────────────────────────────────────────────────────────
    {
        const auto t = iso_date::parse("2026-06-12T08:30:00.123Z");
        check(t && iso_date::jsonString(*t) == "2026-06-12T08:30:00.123Z",
              "iso_date: Z 后缀往返");
    }
    {
        const auto t = iso_date::parse("2026-06-12 08:30:00.123456+00:00");
        check(t && iso_date::sqliteString(*t) == "2026-06-12T08:30:00.123456+00:00",
              "iso_date: 空格分隔 + 微秒");
    }
    {
        // PG timestamptz 文本输出：2 位偏移 + 截尾小数
        const auto t = iso_date::parse("2026-06-12 08:30:00.5+00");
        check(t && iso_date::jsonString(*t) == "2026-06-12T08:30:00.500Z",
              "iso_date: PG 短偏移 + 截尾小数");
    }
    {
        const auto t = iso_date::parse("2026-06-12T16:30:00+08:00");
        check(t && iso_date::jsonString(*t) == "2026-06-12T08:30:00.000Z",
              "iso_date: 偏移归一化 UTC");
    }
    check(!iso_date::parse("not-a-date") && !iso_date::parse("2026-13-01T00:00:00Z") &&
              !iso_date::parse("2026-02-30T00:00:00Z"),
          "iso_date: 拒绝非法输入");
    {
        const auto a = iso_date::parse("2026-01-02T00:00:00.000001Z");
        const auto b = iso_date::parse("2026-01-02T00:00:00.000002Z");
        check(a && b && iso_date::sqliteString(*a) < iso_date::sqliteString(*b),
              "iso_date: SQLite 文本序即时间序");
    }

    // ── uuid ────────────────────────────────────────────────────────────────
    {
        const std::string u = newUuid();
        check(u.size() == 36 && normalizeUuid(u) == u, "uuid: v4 生成 + 归一化");
        std::string hex;
        for (char c : u)
            if (c != '-')
                hex += c;
        check(normalizeUuid(hex) == u, "uuid: 32 位 hex 还原带横线");
        check(!normalizeUuid("not-a-uuid") && !normalizeUuid("12345"),
              "uuid: 拒绝非法输入");
    }

    // ── validation ──────────────────────────────────────────────────────────
    check(validation::password(std::string("abc12345"), "password") == "abc12345",
          "validation: 合法密码");
    check(throwsValidation([] { validation::password(std::string("12345678"), "password"); }) &&
              throwsValidation([] { validation::password(std::string("abcdefgh"), "password"); }) &&
              throwsValidation([] { validation::password(std::string("a1b2c3"), "password"); }),
          "validation: 密码缺字母/缺数字/过短");
    check(validation::nickname(std::string("小明_01")) == "小明_01" &&
              validation::nickname(std::string("ab-cd")) == "ab-cd",
          "validation: 合法昵称（CJK/连字符）");
    check(throwsValidation([] { validation::nickname(std::string("a")); }) &&
              throwsValidation([] { validation::nickname(std::string("有 空格")); }) &&
              throwsValidation([] { validation::nickname(std::string("bad!name")); }),
          "validation: 非法昵称");
    check(validation::email(std::string("  a@b.co  ")) == "a@b.co" &&
              throwsValidation([] { validation::email(std::string("not-an-email")); }),
          "validation: 邮箱 trim + 格式");
    {
        const std::string cjk60(60 * 3, 'x');
        std::string sixty;
        for (int i = 0; i < 60; ++i)
            sixty += "时";
        check(validation::title(sixty) == sixty &&
                  throwsValidation([&] { validation::title(sixty + "多"); }),
              "validation: 标题按码点计数");
    }
    check(validation::codepointCount("时光abc") == 5, "validation: UTF-8 码点计数");

    // ── security ────────────────────────────────────────────────────────────
    AppConfig config;
    config.jwtSecret = "unit-test-secret";
    config.accessTokenTtlSeconds = 3600;
    User user;
    user.id = newUuid();
    user.nickname = "tester";
    user.avatarId = "cat";
    {
        const int64_t nowSec = iso_date::now() / 1000000;
        const std::string token = security::createAccessToken(config, user, nowSec);
        const auto decoded = security::decodeAccessToken(config, token, nowSec);
        check(decoded.subject && *decoded.subject == user.id && !decoded.error,
              "jwt: 签发-校验往返");
        const auto expired = security::decodeAccessToken(config, token, nowSec + 7200);
        check(!expired.subject && std::string(expired.error) == "access_token_expired",
              "jwt: 过期识别");
        const auto tampered = security::decodeAccessToken(config, token + "x", nowSec);
        check(!tampered.subject && std::string(tampered.error) == "invalid_token",
              "jwt: 篡改识别");
        check(!security::decodeAccessToken(config, "garbage", nowSec).subject,
              "jwt: 非法形态识别");
    }
    {
        const std::string t1 = security::generateRefreshToken();
        const std::string t2 = security::generateRefreshToken();
        check(t1 != t2 && t1.size() >= 42, "refresh token: 随机且 base64url 形态");
        const std::string h = security::hashRefreshToken(t1);
        check(h.size() == 64 && h == security::hashRefreshToken(t1),
              "refresh token: SHA-256 hex 确定性");
    }
    {
        const std::string hash = security::hashPassword("HelloTime2026!");
        check(hash.rfind("$2b$10$", 0) == 0 && hash.size() == 60, "bcrypt: $2b$ cost 10 形态");
        check(security::verifyPassword("HelloTime2026!", hash) &&
                  !security::verifyPassword("WrongPass1", hash),
              "bcrypt: 往返验证");
        // 与 Python bcrypt（seed 工具链）生成的已知向量互验。
        check(security::verifyPassword(
                  "HelloTime2026!",
                  "$2b$10$tQYgNdnDSAzOZORCwsaq6uSwv6GT5WNUG7rlBdcSDkwXOWVhSZ2bW"),
              "bcrypt: Python seed $2b$ 向量互验");
    }

    // ── 占位符转换 ───────────────────────────────────────────────────────────
    check(toDollarPlaceholders("SELECT * FROM t WHERE a = ? AND b = ?") ==
              "SELECT * FROM t WHERE a = $1 AND b = $2",
          "db: ? → $n 转换");

    // ── 码生成 ───────────────────────────────────────────────────────────────
    for (int i = 0; i < 20; ++i)
    {
        const std::string code = capsule_service::generateCode();
        bool ok = code.size() == 8;
        for (char c : code)
            ok = ok && ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'));
        if (!ok)
        {
            std::cerr << "FAIL: code gen" << std::endl;
            return 1;
        }
    }
    check(true, "capsule: 8 位大写字母数字码");

    // ── LLM 解析 ────────────────────────────────────────────────────────────
    {
        const Json::Value v =
            LlmClient::parseJsonObject("```json\n{\"a\": 1}\n```");
        check(v["a"].asInt() == 1, "llm: 剥围栏解析");
        const Json::Value v2 = LlmClient::parseJsonObject("前缀 {\"b\": 2} 后缀");
        check(v2["b"].asInt() == 2, "llm: 截取花括号解析");
        int64_t out = 0;
        Json::Value d(10.0);
        check(LlmClient::valueAsInt(d, out) && out == 10, "llm: 容忍 10.0 浮点形态");
    }
    {
        Json::Value raw(Json::arrayValue);
        auto mk = [](const char *t, const char *h, Json::Value days) {
            Json::Value e(Json::objectValue);
            e["title"] = t;
            e["hint"] = h;
            e["openInDays"] = days;
            return e;
        };
        raw.append(mk("主题A", "提示A", 30));
        raw.append(mk("主题A", "重复去重", 60));
        raw.append(mk("主题B", "钳位", 99999));
        Json::Value noDays(Json::objectValue);
        noDays["title"] = "主题C";
        noDays["hint"] = "缺天数";
        raw.append(noDays);
        const Json::Value items = RecommendationService::parseItems(raw, 8);
        check(items.size() == 2 && items[0]["title"] == "主题A" &&
                  items[1]["openInDays"].asInt64() == 3650,
              "recommendation: 去重 + 钳位 + 跳过缺字段");
    }
    {
        check(SuggestionService::cleanTitle("《写给未来》") == "写给未来" &&
                  SuggestionService::cleanTitle("# 标题\n第二行") == "标题 第二行",
              "suggestion: 标题清洗");
        const auto fb = SuggestionService::fallback(false, "我的标题");
        check(fb.title == "我的标题" && fb.content.find("我的标题") != std::string::npos,
              "suggestion: 带标题兜底");
        const auto fb2 = SuggestionService::fallback(true, "");
        check(!fb2.title.empty() && fb2.days >= 1 && fb2.days <= 3650,
              "suggestion: 自动标题兜底");
    }

    // ── mapper 截断 ──────────────────────────────────────────────────────────
    {
        std::string s;
        for (int i = 0; i < 100; ++i)
            s += "字";
        const std::string cut = mapper::truncateCodepoints(s, 80);
        check(validation::codepointCount(cut) == 80, "mapper: 码点级截断");
    }

    std::cout << "\nall " << passed << " checks passed" << std::endl;
    return 0;
}
