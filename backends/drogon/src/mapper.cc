#include "mapper.h"

#include "iso_date.h"
#include "validation.h"

namespace mapper
{
namespace
{
std::string trimWhitespace(const std::string &s)
{
    const auto begin = s.find_first_not_of(" \t\r\n");
    const auto end = s.find_last_not_of(" \t\r\n");
    if (begin == std::string::npos)
        return "";
    return s.substr(begin, end - begin + 1);
}

Json::Value base(const CapsuleView &view, bool opened)
{
    const Capsule &c = view.capsule;
    Json::Value obj(Json::objectValue);
    obj["id"] = c.id;
    obj["code"] = c.code;
    obj["title"] = c.title;
    Json::Value creator(Json::objectValue);
    creator["nickname"] = view.ownerNickname;
    creator["avatarId"] = view.ownerAvatarId;
    obj["creator"] = creator;
    obj["openAt"] = iso_date::jsonString(c.openAt);
    obj["createdAt"] = iso_date::jsonString(c.createdAt);
    obj["inPlaza"] = c.inPlaza;
    obj["favoriteCount"] = Json::Int64(c.favoriteCount);
    obj["isOpened"] = opened;
    return obj;
}
}  // namespace

std::string truncateCodepoints(const std::string &s, size_t n)
{
    size_t count = 0;
    size_t bytes = 0;
    while (bytes < s.size())
    {
        if ((static_cast<unsigned char>(s[bytes]) & 0xC0) != 0x80)
        {
            if (count == n)
                break;
            ++count;
        }
        ++bytes;
    }
    return s.substr(0, bytes);
}

Json::Value user(const User &u)
{
    Json::Value obj(Json::objectValue);
    obj["id"] = u.id;
    obj["email"] = u.email;
    obj["nickname"] = u.nickname;
    obj["avatarId"] = u.avatarId;
    obj["createdAt"] = iso_date::jsonString(u.createdAt);
    return obj;
}

Json::Value detail(const CapsuleView &view, bool favoritedByMe, int64_t now)
{
    const Capsule &c = view.capsule;
    const bool opened = c.openAt <= now;
    Json::Value obj = base(view, opened);
    obj["content"] = opened ? Json::Value(c.content) : Json::nullValue;
    obj["favoritedByMe"] = favoritedByMe;
    return obj;
}

Json::Value listItem(const CapsuleView &view, int64_t now)
{
    const Capsule &c = view.capsule;
    const bool opened = c.openAt <= now;
    Json::Value obj = base(view, opened);
    obj["favoritedByMe"] = view.favoritedByMe;
    obj["favoritedAt"] = view.favoritedAt ? Json::Value(iso_date::jsonString(*view.favoritedAt))
                                          : Json::nullValue;
    if (opened)
    {
        const std::string trimmed = trimWhitespace(c.content);
        if (validation::codepointCount(trimmed) > 80)
            obj["contentPreview"] = truncateCodepoints(trimmed, 80) + "…";
        else
            obj["contentPreview"] = trimmed;
    }
    else
        obj["contentPreview"] = Json::nullValue;
    return obj;
}

Json::Value pagination(int64_t total, int64_t page, int64_t pageSize)
{
    Json::Value obj(Json::objectValue);
    obj["page"] = Json::Int64(page);
    obj["pageSize"] = Json::Int64(pageSize);
    obj["total"] = Json::Int64(total);
    obj["totalPages"] = Json::Int64(pageSize == 0 ? 0 : (total + pageSize - 1) / pageSize);
    return obj;
}

Json::Value paginated(Json::Value items, int64_t total, int64_t page, int64_t pageSize)
{
    Json::Value obj(Json::objectValue);
    obj["items"] = std::move(items);
    obj["pagination"] = pagination(total, page, pageSize);
    return obj;
}
}  // namespace mapper
