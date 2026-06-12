#include "security.h"

#include <json/json.h>
#include <node_blf.h>
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/sha.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace security
{
namespace
{
std::string compactJson(const Json::Value &v)
{
    Json::StreamWriterBuilder builder;
    builder["indentation"] = "";
    return Json::writeString(builder, v);
}

std::string hmacSha256(const std::string &key, const std::string &data)
{
    unsigned char mac[EVP_MAX_MD_SIZE];
    unsigned int macLen = 0;
    HMAC(EVP_sha256(), key.data(), static_cast<int>(key.size()),
         reinterpret_cast<const unsigned char *>(data.data()), data.size(), mac, &macLen);
    return std::string(reinterpret_cast<char *>(mac), macLen);
}
}  // namespace

// ── 密码（third_party/openbsd_bcrypt） ─────────────────────────────────────

std::string hashPassword(const std::string &plain)
{
    unsigned char seed[BCRYPT_MAXSALT];
    arc4random_buf(seed, sizeof(seed));
    // salt "$2b$10$" + 22 字符 ≈ 30 字节；hash 60 字符 + NUL ≈ 61 字节，放宽到 64。
    char salt[64];
    bcrypt_gensalt('b', 10, seed, salt);
    char hashed[64];
    bcrypt(plain.c_str(), plain.size(), salt, hashed);
    if (hashed[0] != '$')
        throw std::runtime_error("bcrypt hash failed");
    return hashed;
}

bool verifyPassword(const std::string &plain, const std::string &hashed)
{
    // 形态防御：bcrypt() 对坏 salt 的行为是写出错误标记。
    if (hashed.size() < 59 || hashed.size() > 61 || hashed.rfind("$2", 0) != 0)
        return false;
    char computed[64];
    bcrypt(plain.c_str(), plain.size(), hashed.c_str(), computed);
    if (computed[0] != '$')
        return false;
    if (std::strlen(computed) != hashed.size())
        return false;
    return CRYPTO_memcmp(computed, hashed.data(), hashed.size()) == 0;
}

// ── JWT HS256 ───────────────────────────────────────────────────────────────
// 标准 JWT 形态：base64url(header).base64url(payload).base64url(HMAC-SHA256)。
// 不引第三方 JWT 库：HS256 签发/校验各 ~20 行，OpenSSL HMAC 即够。

std::string createAccessToken(const AppConfig &config, const User &user, int64_t nowSec)
{
    Json::Value payload(Json::objectValue);
    payload["sub"] = user.id;
    payload["nickname"] = user.nickname;
    payload["avatarId"] = user.avatarId;
    payload["iat"] = Json::Int64(nowSec);
    payload["exp"] = Json::Int64(nowSec + config.accessTokenTtlSeconds);

    static const std::string headerJson = R"({"alg":"HS256","typ":"JWT"})";
    const std::string header =
        base64url(reinterpret_cast<const unsigned char *>(headerJson.data()),
                  headerJson.size());
    const std::string payloadStr = compactJson(payload);
    const std::string body = base64url(
        reinterpret_cast<const unsigned char *>(payloadStr.data()), payloadStr.size());
    const std::string signingInput = header + "." + body;
    const std::string mac = hmacSha256(config.jwtSecret, signingInput);
    return signingInput + "." +
           base64url(reinterpret_cast<const unsigned char *>(mac.data()), mac.size());
}

DecodeResult decodeAccessToken(const AppConfig &config, const std::string &token,
                               int64_t nowSec)
{
    const DecodeResult invalid{std::nullopt, "invalid_token"};

    const auto dot1 = token.find('.');
    if (dot1 == std::string::npos)
        return invalid;
    const auto dot2 = token.find('.', dot1 + 1);
    if (dot2 == std::string::npos || token.find('.', dot2 + 1) != std::string::npos)
        return invalid;

    const std::string signingInput = token.substr(0, dot2);
    const auto signature = base64urlDecode(token.substr(dot2 + 1));
    if (!signature)
        return invalid;
    const std::string expected = hmacSha256(config.jwtSecret, signingInput);
    if (signature->size() != expected.size() ||
        CRYPTO_memcmp(signature->data(), expected.data(), expected.size()) != 0)
        return invalid;

    const auto payloadRaw = base64urlDecode(token.substr(dot1 + 1, dot2 - dot1 - 1));
    if (!payloadRaw)
        return invalid;
    Json::Value payload;
    Json::CharReaderBuilder builder;
    std::string errs;
    const std::unique_ptr<Json::CharReader> reader(builder.newCharReader());
    if (!reader->parse(payloadRaw->data(), payloadRaw->data() + payloadRaw->size(), &payload,
                       &errs) ||
        !payload.isObject())
        return invalid;
    if (!payload.isMember("sub") || !payload["sub"].isString() || !payload.isMember("exp") ||
        !payload["exp"].isIntegral())
        return invalid;
    if (payload["exp"].asInt64() <= nowSec)
        return {std::nullopt, "access_token_expired"};
    return {payload["sub"].asString(), nullptr};
}

// ── Refresh token ───────────────────────────────────────────────────────────

std::string generateRefreshToken()
{
    unsigned char bytes[32];
    arc4random_buf(bytes, sizeof(bytes));
    return base64url(bytes, sizeof(bytes));
}

std::string hashRefreshToken(const std::string &raw)
{
    unsigned char digest[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char *>(raw.data()), raw.size(), digest);
    char out[SHA256_DIGEST_LENGTH * 2 + 1];
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i)
        std::snprintf(out + i * 2, 3, "%02x", digest[i]);
    return out;
}

// ── base64url ───────────────────────────────────────────────────────────────

namespace
{
constexpr char kAlphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

int charValue(char c)
{
    if (c >= 'A' && c <= 'Z')
        return c - 'A';
    if (c >= 'a' && c <= 'z')
        return c - 'a' + 26;
    if (c >= '0' && c <= '9')
        return c - '0' + 52;
    if (c == '-')
        return 62;
    if (c == '_')
        return 63;
    return -1;
}
}  // namespace

std::string base64url(const unsigned char *data, size_t len)
{
    std::string out;
    out.reserve((len + 2) / 3 * 4);
    for (size_t i = 0; i < len; i += 3)
    {
        const unsigned b0 = data[i];
        const unsigned b1 = i + 1 < len ? data[i + 1] : 0;
        const unsigned b2 = i + 2 < len ? data[i + 2] : 0;
        out += kAlphabet[b0 >> 2];
        out += kAlphabet[((b0 & 0x03) << 4) | (b1 >> 4)];
        if (i + 1 < len)
            out += kAlphabet[((b1 & 0x0F) << 2) | (b2 >> 6)];
        if (i + 2 < len)
            out += kAlphabet[b2 & 0x3F];
    }
    return out;
}

std::optional<std::string> base64urlDecode(const std::string &s)
{
    if (s.size() % 4 == 1)
        return std::nullopt;
    std::string out;
    out.reserve(s.size() * 3 / 4);
    int acc = 0;
    int bits = 0;
    for (char c : s)
    {
        const int v = charValue(c);
        if (v < 0)
            return std::nullopt;
        acc = (acc << 6) | v;
        bits += 6;
        if (bits >= 8)
        {
            bits -= 8;
            out += static_cast<char>((acc >> bits) & 0xFF);
        }
    }
    return out;
}
}  // namespace security
