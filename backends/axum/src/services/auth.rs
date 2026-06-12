use chrono::{Duration, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::domain::{RefreshTokenRow, User};
use crate::infra::db::Conn;
use crate::infra::repos::{refresh_tokens, users};
use crate::services::{mapper, security, validation};
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};
use crate::web::requests::{ChangePasswordRequest, LoginRequest, RegisterRequest};

/// 注册 / 登录 / 刷新 / 登出 / 改密。对应 Vapor 的 AuthService。

pub async fn register(state: &AppState, req: &RegisterRequest) -> ApiResult<Value> {
    let email = validation::email(req.email.as_deref())?.to_lowercase();
    let raw_password = validation::password(req.password.as_deref(), "password")?;
    let nickname = validation::nickname(req.nickname.as_deref())?;
    let avatar_id = validation::avatar_format(req.avatar_id.as_deref())?;
    if !state.avatars.exists(&avatar_id) {
        return Err(ApiError::validation("头像 ID 不存在", "avatarId"));
    }
    let password_hash = security::hash_password(&raw_password).map_err(ApiError::internal)?;

    let mut conn = state.db.begin().await?;
    let result = async {
        if users::exists_by_email(&mut conn, &email).await? {
            return Err(ApiError::conflict("邮箱已被注册", "email"));
        }
        if users::exists_by_nickname(&mut conn, &nickname).await? {
            return Err(ApiError::conflict("昵称已被使用", "nickname"));
        }
        let now = Utc::now();
        let user = User {
            id: Uuid::new_v4(),
            email,
            password_hash,
            nickname,
            avatar_id,
            created_at: now,
            updated_at: now,
        };
        users::insert(&mut conn, &user).await?;
        issue_token_pair(state, &mut conn, &user, None).await
    }
    .await;
    conn.finish(result).await
}

pub async fn login(state: &AppState, req: &LoginRequest) -> ApiResult<Value> {
    let email = validation::email(req.email.as_deref())?.to_lowercase();
    let password = validation::require_non_blank(req.password.as_deref(), "password")?;
    if state.rate_limiter.is_limited(&email) {
        return Err(ApiError::rate_limited("操作过于频繁，请稍后再试"));
    }

    let mut conn = state.db.begin().await?;
    let result: ApiResult<Option<Value>> = async {
        let Some(user) = users::find_by_email(&mut conn, &email).await? else {
            return Ok(None);
        };
        if !security::verify_password(&password, &user.password_hash) {
            return Ok(None);
        }
        Ok(Some(issue_token_pair(state, &mut conn, &user, None).await?))
    }
    .await;
    match conn.finish(result).await? {
        Some(tokens) => Ok(tokens),
        None => {
            state.rate_limiter.record_failure(&email);
            Err(ApiError::unauthorized("邮箱或密码错误"))
        }
    }
}

enum RefreshOutcome {
    Success(Value),
    Invalid,
    Reused,
}

pub async fn refresh(state: &AppState, raw_refresh: Option<&str>) -> ApiResult<Value> {
    let raw = validation::require_non_blank(raw_refresh, "refreshToken")?;
    let token_hash = security::hash_refresh_token(&raw);

    // 关键：重用检测分支必须提交 family 吊销后再抛 401，
    // 所以事务内不抛异常，用 outcome 区分，错误转换放到 COMMIT 之后。
    let mut conn = state.db.begin().await?;
    let result: ApiResult<RefreshOutcome> = async {
        let Some(row) =
            refresh_tokens::find_by_token_hash_for_update(&mut conn, &token_hash).await?
        else {
            return Ok(RefreshOutcome::Invalid);
        };
        let now = Utc::now();
        if row.expires_at <= now {
            return Ok(RefreshOutcome::Invalid);
        }
        if row.revoked_at.is_some() {
            refresh_tokens::revoke_family(&mut conn, &row.family_id, &now).await?;
            return Ok(RefreshOutcome::Reused);
        }
        let Some(user) = users::find_by_id(&mut conn, &row.user_id).await? else {
            return Ok(RefreshOutcome::Invalid);
        };
        refresh_tokens::mark_revoked(&mut conn, &row.id, &now).await?;
        let tokens = issue_token_pair(state, &mut conn, &user, Some(row.family_id)).await?;
        Ok(RefreshOutcome::Success(tokens))
    }
    .await;
    match conn.finish(result).await? {
        RefreshOutcome::Success(tokens) => Ok(tokens),
        RefreshOutcome::Invalid => Err(ApiError::unauthorized("refresh token 无效")),
        RefreshOutcome::Reused => Err(ApiError::unauthorized("refresh token 已失效")),
    }
}

pub async fn logout(state: &AppState, raw_refresh: Option<&str>) -> ApiResult<()> {
    let Some(raw) = raw_refresh.filter(|r| !r.is_empty()) else {
        return Ok(());
    };
    let hash = security::hash_refresh_token(raw);
    let mut conn = state.db.begin().await?;
    let result = async {
        if let Some(row) = refresh_tokens::find_by_token_hash(&mut conn, &hash).await? {
            if row.revoked_at.is_none() {
                refresh_tokens::mark_revoked(&mut conn, &row.id, &Utc::now()).await?;
            }
        }
        Ok(())
    }
    .await;
    conn.finish(result).await
}

pub async fn change_password(
    state: &AppState,
    user: &User,
    req: &ChangePasswordRequest,
) -> ApiResult<()> {
    let current = validation::require_non_blank(req.current_password.as_deref(), "currentPassword")?;
    let new_password = validation::password(req.new_password.as_deref(), "newPassword")?;
    if !security::verify_password(&current, &user.password_hash) {
        return Err(ApiError::unauthorized("当前密码错误"));
    }
    let new_hash = security::hash_password(&new_password).map_err(ApiError::internal)?;

    let mut conn = state.db.begin().await?;
    let result = async {
        let now = Utc::now();
        users::update_password(&mut conn, &user.id, &new_hash, &now).await?;
        // 改密后吊销该用户所有 refresh token（含当前会话）。
        refresh_tokens::revoke_user(&mut conn, &user.id, &now).await?;
        Ok(())
    }
    .await;
    conn.finish(result).await
}

/// 在当前事务内签发 access + refresh 对，并落库 refresh token 行。
async fn issue_token_pair(
    state: &AppState,
    conn: &mut Conn,
    user: &User,
    family_id: Option<Uuid>,
) -> ApiResult<Value> {
    let now = Utc::now();
    let access = security::create_access_token(&state.config, user, &now);
    let refresh = security::generate_refresh_token();
    refresh_tokens::insert(
        conn,
        &RefreshTokenRow {
            id: Uuid::new_v4(),
            user_id: user.id,
            token_hash: security::hash_refresh_token(&refresh),
            family_id: family_id.unwrap_or_else(Uuid::new_v4),
            expires_at: now + Duration::seconds(state.config.refresh_token_ttl_seconds),
            created_at: now,
            revoked_at: None,
        },
    )
    .await?;
    Ok(json!({
        "accessToken": access,
        "refreshToken": refresh,
        "accessTokenExpiresIn": state.config.access_token_ttl_seconds,
        "refreshTokenExpiresIn": state.config.refresh_token_ttl_seconds,
        "user": mapper::user(user),
    }))
}
