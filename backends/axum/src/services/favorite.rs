use chrono::Utc;
use serde_json::{json, Value};

use crate::domain::User;
use crate::infra::db::parse_uuid;
use crate::infra::iso_date;
use crate::infra::repos::{capsules, favorites};
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};

/// 收藏 / 取消收藏。favorite_count 是冗余计数器，必须和 favorites 行变更同处一个事务。
/// 并发安全：幂等 UPSERT（ON CONFLICT DO NOTHING RETURNING）判定是否真插入，
/// 配合原子 `favorite_count = favorite_count + 1`，无需行锁也不会重复计数；
/// SQLite 路径由池上限 1 + BEGIN IMMEDIATE 天然串行。

pub async fn add_favorite(
    state: &AppState,
    user: &User,
    capsule_id_raw: Option<&str>,
) -> ApiResult<Value> {
    let Some(capsule_id) = capsule_id_raw.and_then(parse_uuid) else {
        return Err(ApiError::not_found("胶囊不存在"));
    };
    let mut conn = state.db.begin().await?;
    let result = async {
        let Some(view) = capsules::find_by_id(&mut conn, &capsule_id).await? else {
            return Err(ApiError::not_found("胶囊不存在"));
        };
        let capsule = &view.capsule;
        if !capsule.in_plaza {
            return Err(ApiError::not_found("胶囊不存在"));
        }
        if capsule.owner_id == user.id {
            return Err(ApiError::bad_request("不能收藏自己创建的胶囊"));
        }

        let now = Utc::now();
        let inserted =
            favorites::insert_ignore(&mut conn, &user.id, &capsule.id, &now).await?;
        let favorited_at = if inserted {
            capsules::increment_favorite_count(&mut conn, &capsule.id, &now).await?;
            now
        } else {
            // 幂等：已收藏时返回原收藏时间，计数不变。
            favorites::find(&mut conn, &user.id, &capsule.id).await?.unwrap_or(now)
        };
        let count = capsules::favorite_count_of(&mut conn, &capsule.id).await?;
        Ok(json!({
            "capsuleId": capsule.id.to_string(),
            "favoriteCount": count,
            "favoritedAt": iso_date::json_string(&favorited_at),
        }))
    }
    .await;
    conn.finish(result).await
}

/// 取消收藏幂等：胶囊不存在/格式非法/原本未收藏都返回成功（204）。
pub async fn remove_favorite(state: &AppState, user: &User, capsule_id_raw: &str) -> ApiResult<()> {
    let Some(capsule_id) = parse_uuid(capsule_id_raw) else {
        return Ok(());
    };
    let mut conn = state.db.begin().await?;
    let result = async {
        let deleted = favorites::delete(&mut conn, &user.id, &capsule_id).await?;
        if deleted {
            capsules::decrement_favorite_count(&mut conn, &capsule_id, &Utc::now()).await?;
        }
        Ok(())
    }
    .await;
    conn.finish(result).await
}
