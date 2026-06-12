use axum::http::HeaderMap;
use chrono::Utc;

use crate::domain::User;
use crate::infra::db::parse_uuid;
use crate::infra::repos::users;
use crate::services::security;
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};

/// 从 Authorization 头解析 Bearer JWT 并加载当前用户。对应 Vapor 的 AuthContext。

/// 匿名可访问端点：无/非法 token 返回 None。
pub async fn optional_user(state: &AppState, headers: &HeaderMap) -> ApiResult<Option<User>> {
    let Some(token) = parse_bearer(headers) else {
        return Ok(None);
    };
    let decoded = security::decode_access_token(&state.config, &token, &Utc::now());
    let Some(subject) = decoded.subject else {
        return Ok(None);
    };
    let Some(id) = parse_uuid(&subject) else {
        return Ok(None);
    };
    let mut conn = state.db.acquire().await?;
    users::find_by_id(&mut conn, &id).await
}

/// 受保护端点：缺失/过期/非法 → UNAUTHORIZED。
pub async fn required_user(state: &AppState, headers: &HeaderMap) -> ApiResult<User> {
    let Some(token) = parse_bearer(headers) else {
        return Err(ApiError::unauthorized("缺少 access token"));
    };
    let decoded = security::decode_access_token(&state.config, &token, &Utc::now());
    let Some(subject) = decoded.subject else {
        return Err(ApiError::unauthorized(decoded.error.unwrap_or("invalid_token")));
    };
    let Some(id) = parse_uuid(&subject) else {
        return Err(ApiError::unauthorized("invalid_token"));
    };
    let mut conn = state.db.acquire().await?;
    users::find_by_id(&mut conn, &id)
        .await?
        .ok_or_else(|| ApiError::unauthorized("用户不存在"))
}

fn parse_bearer(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get("authorization")?.to_str().ok()?.trim();
    if raw.is_empty() {
        return None;
    }
    let mut parts = raw.splitn(2, ' ');
    let scheme = parts.next()?;
    let token = parts.next()?;
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }
    let token = token.trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}
