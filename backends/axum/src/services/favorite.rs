use chrono::Utc;
use serde_json::{json, Value};

use crate::domain::User;
use crate::infra::iso_date;
use crate::infra::repos::{capsules, favorites};
use crate::services::validation;
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};

/// 收藏 / 取消收藏。favorite_count 是冗余计数器，必须和 favorites 行变更同处一个事务。
/// PostgreSQL 收藏、取消和删除统一先锁胶囊行；幂等 UPSERT 配合原子加减维护计数；
/// SQLite 路径由池上限 1 + BEGIN IMMEDIATE 天然串行。

pub async fn add_favorite(
    state: &AppState,
    user: &User,
    capsule_id_raw: Option<&str>,
) -> ApiResult<Value> {
    let capsule_id = validation::capsule_id(capsule_id_raw, "capsuleId")?;
    let mut conn = state.db.begin().await?;
    let result = async {
        if capsules::lock_owner_id(&mut conn, &capsule_id).await?.is_none() {
            return Err(ApiError::not_found("胶囊不存在"));
        }

        let now = Utc::now();
        let inserted =
            favorites::insert_ignore(&mut conn, &user.id, &capsule_id, &now).await?;
        let favorited_at = if inserted {
            capsules::increment_favorite_count(&mut conn, &capsule_id, &now).await?;
            now
        } else {
            // 幂等：已收藏时返回原收藏时间，计数不变。
            favorites::find(&mut conn, &user.id, &capsule_id).await?.unwrap_or(now)
        };
        let count = capsules::favorite_count_of(&mut conn, &capsule_id).await?;
        Ok(json!({
            "capsuleId": capsule_id.to_string(),
            "favoriteCount": count,
            "favoritedAt": iso_date::json_string(&favorited_at),
        }))
    }
    .await;
    conn.finish(result).await
}

/// 合法 UUID 取消收藏幂等：胶囊不存在/原本未收藏返回成功（204）。
pub async fn remove_favorite(state: &AppState, user: &User, capsule_id_raw: &str) -> ApiResult<()> {
    let capsule_id = validation::capsule_id(Some(capsule_id_raw), "capsuleId")?;
    let mut conn = state.db.begin().await?;
    let result = async {
        if capsules::lock_owner_id(&mut conn, &capsule_id).await?.is_none() {
            return Ok(());
        }
        let deleted = favorites::delete(&mut conn, &user.id, &capsule_id).await?;
        if deleted {
            capsules::decrement_favorite_count(&mut conn, &capsule_id, &Utc::now()).await?;
        }
        Ok(())
    }
    .await;
    conn.finish(result).await
}
