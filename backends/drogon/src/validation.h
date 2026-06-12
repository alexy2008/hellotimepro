#pragma once

#include <cstdint>
#include <optional>
#include <string>

// 手写字段校验（与 spec/openapi.yaml 的正则/长度约束一致）。
// 失败统一抛 VALIDATION_ERROR → 422。对应 Axum 的 validation。
//
// 注意两处 C++ 特有处理：
// - std::regex 不支持 lookahead，密码"含字母 + 含数字"改为显式字符扫描；
// - std::regex 不支持 \p{L}\p{N}，昵称改为 UTF-8 码点扫描
//   （ASCII 必须是字母/数字/_/-，≥U+0080 的码点放行——比 Unicode 属性表略宽，
//   教学项目可接受）。
// 长度一律按 Unicode 码点计数，不按字节。
namespace validation
{
// UTF-8 码点数；非法序列按字节计。
size_t codepointCount(const std::string &s);

std::string email(const std::optional<std::string> &value);
std::string requireNonBlank(const std::optional<std::string> &value,
                            const std::string &field);
std::string password(const std::optional<std::string> &value, const std::string &field);
std::string nickname(const std::optional<std::string> &value);
std::string avatarFormat(const std::optional<std::string> &value);
std::string title(const std::optional<std::string> &value);
std::string content(const std::optional<std::string> &value);
int64_t openAt(const std::optional<std::string> &value);  // 返回 UTC 微秒
void code(const std::string &value);
void page(int64_t page, int64_t pageSize);
}  // namespace validation
