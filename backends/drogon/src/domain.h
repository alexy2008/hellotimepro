#pragma once

#include <cstdint>
#include <optional>
#include <string>

// 领域模型：UUID 统一存为小写带横线字符串（SQLite 编解码在 infra 层转 hex），
// 时间为 UTC 微秒时间戳。

struct User
{
    std::string id;
    std::string email;
    std::string passwordHash;
    std::string nickname;
    std::string avatarId;
    int64_t createdAt{0};
    int64_t updatedAt{0};
};

struct Capsule
{
    std::string id;
    std::string ownerId;
    std::string code;
    std::string title;
    std::string content;
    int64_t openAt{0};
    bool inPlaza{true};
    int64_t favoriteCount{0};
    int64_t createdAt{0};
    int64_t updatedAt{0};
};

// 胶囊 + 创建者摘要 +（视情况）收藏状态，对应联表查询的一行。
struct CapsuleView
{
    Capsule capsule;
    std::string ownerNickname;
    std::string ownerAvatarId;
    bool favoritedByMe{false};
    std::optional<int64_t> favoritedAt;
};

struct RefreshTokenRow
{
    std::string id;
    std::string userId;
    std::string tokenHash;
    std::string familyId;
    int64_t expiresAt{0};
    int64_t createdAt{0};
    std::optional<int64_t> revokedAt;
};
