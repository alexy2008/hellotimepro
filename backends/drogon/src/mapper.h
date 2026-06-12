#pragma once

#include <json/json.h>

#include <cstdint>
#include <vector>

#include "domain.h"

// 领域模型 → 响应 JSON。时间统一序列化为 ISO-8601 UTC（`...Z`），
// id 输出小写带横线 UUID（契约正则 `^[0-9a-f-]{32,36}$`）。
namespace mapper
{
Json::Value user(const User &u);
// 详情：未开启 content=null（作者也无特权预览）。
Json::Value detail(const CapsuleView &view, bool favoritedByMe, int64_t now);
// 列表项：不含 content；已开启时给前 80 字符的 contentPreview。
Json::Value listItem(const CapsuleView &view, int64_t now);
Json::Value pagination(int64_t total, int64_t page, int64_t pageSize);
Json::Value paginated(Json::Value items, int64_t total, int64_t page, int64_t pageSize);

// UTF-8 码点级截断辅助（contentPreview / LLM 清洗共用）。
std::string truncateCodepoints(const std::string &s, size_t n);
}  // namespace mapper
