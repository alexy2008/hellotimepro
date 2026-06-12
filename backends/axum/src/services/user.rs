use chrono::Utc;
use serde_json::Value;

use crate::domain::User;
use crate::infra::repos::users;
use crate::services::{mapper, validation};
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};
use crate::web::requests::UpdateProfileRequest;

/// 当前用户资料：查看 / 修改昵称头像。对应 Vapor 的 UserService。

pub fn to_json(user: &User) -> Value {
    mapper::user(user)
}

pub async fn update_profile(
    state: &AppState,
    user: &User,
    req: &UpdateProfileRequest,
) -> ApiResult<Value> {
    if req.nickname.is_none() && req.avatar_id.is_none() {
        return Err(ApiError::validation("至少提供 nickname 或 avatarId 之一", "body"));
    }
    let nickname = match &req.nickname {
        Some(n) => validation::nickname(Some(n))?,
        None => user.nickname.clone(),
    };
    let avatar_id = match &req.avatar_id {
        Some(a) => validation::avatar_format(Some(a))?,
        None => user.avatar_id.clone(),
    };
    if req.avatar_id.is_some() && !state.avatars.exists(&avatar_id) {
        return Err(ApiError::validation("头像 ID 不存在", "avatarId"));
    }

    let mut conn = state.db.begin().await?;
    let result = async {
        if nickname != user.nickname && users::exists_by_nickname(&mut conn, &nickname).await? {
            return Err(ApiError::conflict("昵称已被使用", "nickname"));
        }
        let now = Utc::now();
        users::update_profile(&mut conn, &user.id, &nickname, &avatar_id, &now).await?;
        let updated = User {
            nickname: nickname.clone(),
            avatar_id: avatar_id.clone(),
            updated_at: now,
            ..user.clone()
        };
        Ok(mapper::user(&updated))
    }
    .await;
    conn.finish(result).await
}
