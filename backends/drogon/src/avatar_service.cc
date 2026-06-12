#include "avatar_service.h"

#include <fstream>
#include <stdexcept>

AvatarService::AvatarService(const AppConfig &config)
{
    const std::string path = config.absRepoRoot() + "/spec/avatars/catalog.json";
    std::ifstream in(path);
    if (!in)
        throw std::runtime_error("读取头像目录失败: " + path);
    Json::Value catalog;
    Json::CharReaderBuilder builder;
    std::string errs;
    if (!Json::parseFromStream(builder, in, &catalog, &errs))
        throw std::runtime_error("解析头像目录失败: " + errs);
    if (!catalog.isMember("avatars") || !catalog["avatars"].isArray())
        throw std::runtime_error("头像目录缺少 avatars 数组");

    for (const auto &a : catalog["avatars"])
    {
        const std::string id = a.get("id", "").asString();
        ids_.insert(id);
        Json::Value item(Json::objectValue);
        item["id"] = id;
        item["name"] = a.get("name", Json::nullValue);
        item["primaryColor"] = a.get("primaryColor", Json::nullValue);
        // svgUrl 可缺省 → 显式输出 null。
        item["svgUrl"] = a.get("svgUrl", Json::nullValue);
        list_.append(item);
    }
}
