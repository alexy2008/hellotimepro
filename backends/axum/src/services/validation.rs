use chrono::{DateTime, Utc};
use regex::Regex;
use std::sync::OnceLock;

use crate::infra::iso_date;
use crate::web::error::{ApiError, ApiResult};

/// 手写字段校验（与 spec/openapi.yaml 的正则/长度约束一致）。
/// 失败统一抛 VALIDATION_ERROR → 422。对应 Vapor 的 Validation。
///
/// 注意：Rust regex crate 不支持 lookahead，密码的"含字母 + 含数字"
/// 改为显式字符扫描（语义与 `(?=.*[A-Za-z])(?=.*\d).{8,128}` 等价）。

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).unwrap())
}

fn email_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    re(&RE, r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
}

fn nickname_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    re(&RE, r"^[\p{L}\p{N}_-]{2,20}$")
}

fn avatar_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    re(&RE, r"^[a-z0-9-]{2,20}$")
}

fn code_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    re(&RE, r"^[A-Za-z0-9]{8}$")
}

pub fn email(value: Option<&str>) -> ApiResult<String> {
    let e = value.unwrap_or("").trim().to_string();
    if e.is_empty() || e.chars().count() > 254 || !email_re().is_match(&e) {
        return Err(ApiError::validation("邮箱格式不正确", "email"));
    }
    Ok(e)
}

pub fn require_non_blank(value: Option<&str>, field: &str) -> ApiResult<String> {
    match value {
        Some(v) if !v.trim().is_empty() => Ok(v.to_string()),
        _ => Err(ApiError::validation(format!("{field} 不能为空"), field)),
    }
}

pub fn password(value: Option<&str>, field: &str) -> ApiResult<String> {
    let v = value.unwrap_or("");
    let len = v.chars().count();
    let has_letter = v.chars().any(|c| c.is_ascii_alphabetic());
    let has_digit = v.chars().any(|c| c.is_ascii_digit());
    if !(8..=128).contains(&len) || !has_letter || !has_digit {
        return Err(ApiError::validation("密码至少 8 位且需包含字母和数字", field));
    }
    Ok(v.to_string())
}

pub fn nickname(value: Option<&str>) -> ApiResult<String> {
    match value {
        Some(v) if nickname_re().is_match(v) => Ok(v.to_string()),
        _ => Err(ApiError::validation("昵称需为 2-20 位字母/数字/下划线/连字符", "nickname")),
    }
}

pub fn avatar_format(value: Option<&str>) -> ApiResult<String> {
    match value {
        Some(v) if avatar_re().is_match(v) => Ok(v.to_string()),
        _ => Err(ApiError::validation("头像 ID 格式不正确", "avatarId")),
    }
}

pub fn title(value: Option<&str>) -> ApiResult<String> {
    match value {
        Some(v) if !v.is_empty() && v.chars().count() <= 60 => Ok(v.to_string()),
        _ => Err(ApiError::validation("标题长度需为 1-60", "title")),
    }
}

pub fn content(value: Option<&str>) -> ApiResult<String> {
    match value {
        Some(v) if !v.is_empty() && v.chars().count() <= 5000 => Ok(v.to_string()),
        _ => Err(ApiError::validation("内容长度需为 1-5000", "content")),
    }
}

pub fn open_at(value: Option<&str>) -> ApiResult<DateTime<Utc>> {
    let v = match value {
        Some(v) if !v.is_empty() => v,
        _ => return Err(ApiError::validation("openAt 不能为空", "openAt")),
    };
    iso_date::parse(v).ok_or_else(|| ApiError::validation("openAt 必须是 ISO-8601 时间", "openAt"))
}

pub fn code(value: &str) -> ApiResult<()> {
    if !code_re().is_match(value) {
        return Err(ApiError::validation("code 必须为 8 位字母数字", "code"));
    }
    Ok(())
}

pub fn page(page: i64, page_size: i64) -> ApiResult<()> {
    if page < 1 {
        return Err(ApiError::validation("page 必须 >= 1", "page"));
    }
    if !(1..=50).contains(&page_size) {
        return Err(ApiError::validation("pageSize 范围 1-50", "pageSize"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_rules() {
        assert!(password(Some("abc12345"), "password").is_ok());
        assert!(password(Some("12345678"), "password").is_err()); // 无字母
        assert!(password(Some("abcdefgh"), "password").is_err()); // 无数字
        assert!(password(Some("a1b2c3"), "password").is_err()); // 过短
        assert!(password(None, "password").is_err());
    }

    #[test]
    fn nickname_rules() {
        assert!(nickname(Some("小明_01")).is_ok());
        assert!(nickname(Some("ab-cd")).is_ok());
        assert!(nickname(Some("a")).is_err()); // 过短
        assert!(nickname(Some("有 空格")).is_err());
        assert!(nickname(None).is_err());
    }

    #[test]
    fn email_rules() {
        assert!(email(Some("a@b.co")).is_ok());
        assert!(email(Some("  a@b.co  ")).is_ok()); // trim
        assert!(email(Some("not-an-email")).is_err());
        assert!(email(None).is_err());
    }

    #[test]
    fn code_rules() {
        assert!(code("ABCD1234").is_ok());
        assert!(code("abcd1234").is_ok());
        assert!(code("ABC123").is_err()); // 长度
        assert!(code("ABCD-123").is_err()); // 非法字符
    }

    #[test]
    fn title_counts_chars_not_bytes() {
        let cjk60: String = "时".repeat(60);
        assert!(title(Some(&cjk60)).is_ok());
        let cjk61: String = "时".repeat(61);
        assert!(title(Some(&cjk61)).is_err());
    }
}
