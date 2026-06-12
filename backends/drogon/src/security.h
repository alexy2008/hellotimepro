#pragma once

#include <cstdint>
#include <optional>
#include <string>

#include "config.h"
#include "domain.h"

// 密码哈希（OpenBSD bcrypt，cost 10，$2b$，兼容 seed 的 $2a$/$2b$）
// 与 JWT（HS256，OpenSSL HMAC 手写编解码）+ refresh token 生成/哈希。
namespace security
{
std::string hashPassword(const std::string &plain);
bool verifyPassword(const std::string &plain, const std::string &hashed);

std::string createAccessToken(const AppConfig &config, const User &user, int64_t nowSec);

struct DecodeResult
{
    std::optional<std::string> subject;
    const char *error{nullptr};  // "access_token_expired" | "invalid_token"
};

// 校验 access token。过期统一 error="access_token_expired"；其它非法 error="invalid_token"。
DecodeResult decodeAccessToken(const AppConfig &config, const std::string &token,
                               int64_t nowSec);

// 不透明随机 256-bit base64url 字符串。
std::string generateRefreshToken();
// 落库只存 SHA-256 hex，原文不落库。
std::string hashRefreshToken(const std::string &raw);

std::string base64url(const unsigned char *data, size_t len);
std::optional<std::string> base64urlDecode(const std::string &s);
}  // namespace security
