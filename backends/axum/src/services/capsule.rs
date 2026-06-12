use chrono::{Duration, Months, Utc};
use rand::Rng;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::{Capsule, CapsuleView, User};
use crate::infra::db::{parse_uuid, Conn};
use crate::infra::repos::{capsules, favorites};
use crate::services::{mapper, validation};
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};
use crate::web::requests::CreateCapsuleRequest;

/// 胶囊创建 / 按码查询 / 广场详情 / 删除。对应 Vapor 的 CapsuleService。

const CODE_ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

pub async fn create(state: &AppState, owner: &User, req: &CreateCapsuleRequest) -> ApiResult<Value> {
    let title = validation::title(req.title.as_deref())?;
    let content = validation::content(req.content.as_deref())?;
    let open_at = validation::open_at(req.open_at.as_deref())?;
    let now = Utc::now();
    if open_at < now + Duration::seconds(60) {
        return Err(ApiError::validation("openAt 必须晚于当前时间 60 秒以上", "openAt"));
    }
    let ten_years = now
        .checked_add_months(Months::new(120))
        .ok_or_else(|| ApiError::internal("时间溢出"))?;
    if open_at > ten_years {
        return Err(ApiError::validation("openAt 不得超出当前时间 10 年", "openAt"));
    }
    let in_plaza = req.in_plaza.unwrap_or(true);

    let mut conn = state.db.begin().await?;
    let result = async {
        let mut code = String::new();
        for _ in 0..5 {
            let candidate = generate_code();
            if !capsules::exists_by_code(&mut conn, &candidate).await? {
                code = candidate;
                break;
            }
        }
        if code.is_empty() {
            return Err(ApiError::internal("生成唯一码失败"));
        }
        let capsule = Capsule {
            id: Uuid::new_v4(),
            owner_id: owner.id,
            code,
            title: title.clone(),
            content: content.clone(),
            open_at,
            in_plaza,
            favorite_count: 0,
            created_at: now,
            updated_at: now,
        };
        capsules::insert(&mut conn, &capsule).await?;
        let view = CapsuleView {
            capsule,
            owner_nickname: owner.nickname.clone(),
            owner_avatar_id: owner.avatar_id.clone(),
            favorited_by_me: false,
            favorited_at: None,
        };
        Ok(mapper::detail(&view, false, &Utc::now()))
    }
    .await;
    conn.finish(result).await
}

/// 按 8 位码查询：凭码即可见（包括 inPlaza=false），大小写不敏感。
pub async fn get_by_code(state: &AppState, code: &str, viewer_id: Option<&Uuid>) -> ApiResult<Value> {
    validation::code(code)?;
    let upper = code.to_uppercase();
    let mut conn = state.db.acquire().await?;
    let Some(view) = capsules::find_by_code(&mut conn, &upper).await? else {
        return Err(ApiError::not_found("胶囊不存在"));
    };
    let favorited = is_favorited(&mut conn, viewer_id, &view.capsule.id).await?;
    Ok(mapper::detail(&view, favorited, &Utc::now()))
}

/// 广场详情：仅 inPlaza=true；非法 UUID / 不在广场 → 404。
pub async fn get_plaza_detail(
    state: &AppState,
    id_raw: &str,
    viewer_id: Option<&Uuid>,
) -> ApiResult<Value> {
    let Some(id) = parse_uuid(id_raw) else {
        return Err(ApiError::not_found("胶囊不存在"));
    };
    let mut conn = state.db.acquire().await?;
    let view = match capsules::find_by_id(&mut conn, &id).await? {
        Some(v) if v.capsule.in_plaza => v,
        _ => return Err(ApiError::not_found("胶囊不存在")),
    };
    let favorited = is_favorited(&mut conn, viewer_id, &view.capsule.id).await?;
    Ok(mapper::detail(&view, favorited, &Utc::now()))
}

/// 删除自己的胶囊（无论是否到期）；连同收藏关系一起删。
pub async fn delete_own(state: &AppState, user: &User, id_raw: &str) -> ApiResult<()> {
    let Some(id) = parse_uuid(id_raw) else {
        return Err(ApiError::not_found("胶囊不存在"));
    };
    let mut conn = state.db.begin().await?;
    let result = async {
        let Some(view) = capsules::find_by_id(&mut conn, &id).await? else {
            return Err(ApiError::not_found("胶囊不存在"));
        };
        if view.capsule.owner_id != user.id {
            return Err(ApiError::forbidden("无权删除他人胶囊"));
        }
        favorites::delete_by_capsule(&mut conn, &id).await?;
        capsules::delete(&mut conn, &id).await?;
        Ok(())
    }
    .await;
    conn.finish(result).await
}

async fn is_favorited(
    conn: &mut Conn,
    viewer_id: Option<&Uuid>,
    capsule_id: &Uuid,
) -> ApiResult<bool> {
    match viewer_id {
        Some(viewer_id) => favorites::exists(conn, viewer_id, capsule_id).await,
        None => Ok(false),
    }
}

pub fn generate_code() -> String {
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| CODE_ALPHABET[rng.gen_range(0..CODE_ALPHABET.len())] as char)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_code_is_8_alnum_uppercase() {
        for _ in 0..50 {
            let code = generate_code();
            assert_eq!(code.len(), 8);
            assert!(code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
        }
    }
}
