use chrono::{DateTime, Utc};
use uuid::Uuid;

/// 领域模型：纯数据结构，跨库编解码在 infra 层处理。

#[derive(Clone, Debug)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub nickname: String,
    pub avatar_id: String,
    pub created_at: DateTime<Utc>,
    #[allow(dead_code)]
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct Capsule {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub code: String,
    pub title: String,
    pub content: String,
    pub open_at: DateTime<Utc>,
    pub in_plaza: bool,
    pub favorite_count: i64,
    pub created_at: DateTime<Utc>,
    #[allow(dead_code)]
    pub updated_at: DateTime<Utc>,
}

/// 胶囊 + 创建者摘要 +（视情况）收藏状态，对应联表查询的一行。
#[derive(Clone, Debug)]
pub struct CapsuleView {
    pub capsule: Capsule,
    pub owner_nickname: String,
    pub owner_avatar_id: String,
    pub favorited_by_me: bool,
    pub favorited_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug)]
pub struct RefreshTokenRow {
    pub id: Uuid,
    pub user_id: Uuid,
    #[allow(dead_code)]
    pub token_hash: String,
    pub family_id: Uuid,
    pub expires_at: DateTime<Utc>,
    #[allow(dead_code)]
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}
