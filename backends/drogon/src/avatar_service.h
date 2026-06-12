#pragma once

#include <json/json.h>

#include <set>
#include <string>

#include "config.h"

// 从 spec/avatars/catalog.json 加载内置头像目录（启动时一次）。
class AvatarService
{
  public:
    explicit AvatarService(const AppConfig &config);

    Json::Value list() const
    {
        return list_;
    }

    bool exists(const std::string &id) const
    {
        return ids_.count(id) > 0;
    }

  private:
    Json::Value list_{Json::arrayValue};
    std::set<std::string> ids_;
};
