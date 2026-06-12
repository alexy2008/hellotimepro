use chrono::{DateTime, Utc};
use serde_json::{json, Map, Value};

use crate::domain::{CapsuleView, User};
use crate::infra::iso_date;

/// 领域模型 → 响应 JSON。时间统一序列化为 ISO-8601 UTC（`...Z`），
/// id 输出小写带横线 UUID（契约正则 `^[0-9a-f-]{32,36}$`）。

pub fn user(u: &User) -> Value {
    json!({
        "id": u.id.to_string(),
        "email": u.email,
        "nickname": u.nickname,
        "avatarId": u.avatar_id,
        "createdAt": iso_date::json_string(&u.created_at),
    })
}

/// 详情：未开启 content=null（作者也无特权预览）。
pub fn detail(view: &CapsuleView, favorited_by_me: bool, now: &DateTime<Utc>) -> Value {
    let c = &view.capsule;
    let opened = c.open_at <= *now;
    let mut obj = base(view, opened);
    obj.insert(
        "content".to_string(),
        if opened { Value::String(c.content.clone()) } else { Value::Null },
    );
    obj.insert("favoritedByMe".to_string(), Value::Bool(favorited_by_me));
    Value::Object(obj)
}

/// 列表项：不含 content；已开启时给前 80 字符的 contentPreview。
pub fn list_item(view: &CapsuleView, now: &DateTime<Utc>) -> Value {
    let c = &view.capsule;
    let opened = c.open_at <= *now;
    let mut obj = base(view, opened);
    obj.insert("favoritedByMe".to_string(), Value::Bool(view.favorited_by_me));
    obj.insert(
        "favoritedAt".to_string(),
        match &view.favorited_at {
            Some(t) => Value::String(iso_date::json_string(t)),
            None => Value::Null,
        },
    );
    obj.insert(
        "contentPreview".to_string(),
        if opened {
            let trimmed = c.content.trim();
            let preview: String = trimmed.chars().take(80).collect();
            if trimmed.chars().count() > 80 {
                Value::String(format!("{preview}…"))
            } else {
                Value::String(preview)
            }
        } else {
            Value::Null
        },
    );
    Value::Object(obj)
}

pub fn pagination(total: i64, page: i64, page_size: i64) -> Value {
    let total_pages = if page_size == 0 { 0 } else { (total + page_size - 1) / page_size };
    json!({
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": total_pages,
    })
}

pub fn paginated(items: Vec<Value>, total: i64, page: i64, page_size: i64) -> Value {
    json!({
        "items": items,
        "pagination": pagination(total, page, page_size),
    })
}

fn base(view: &CapsuleView, opened: bool) -> Map<String, Value> {
    let c = &view.capsule;
    let mut obj = Map::new();
    obj.insert("id".to_string(), Value::String(c.id.to_string()));
    obj.insert("code".to_string(), Value::String(c.code.clone()));
    obj.insert("title".to_string(), Value::String(c.title.clone()));
    obj.insert(
        "creator".to_string(),
        json!({"nickname": view.owner_nickname, "avatarId": view.owner_avatar_id}),
    );
    obj.insert("openAt".to_string(), Value::String(iso_date::json_string(&c.open_at)));
    obj.insert("createdAt".to_string(), Value::String(iso_date::json_string(&c.created_at)));
    obj.insert("inPlaza".to_string(), Value::Bool(c.in_plaza));
    obj.insert("favoriteCount".to_string(), Value::Number(c.favorite_count.into()));
    obj.insert("isOpened".to_string(), Value::Bool(opened));
    obj
}
