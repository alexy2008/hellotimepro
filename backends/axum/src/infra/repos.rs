use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::{Capsule, CapsuleView, RefreshTokenRow, User};
use crate::infra::db::{Conn, DbRow, Value};
use crate::web::error::ApiResult;

/// 仓储层：手写参数化 SQL（`?` 占位，跨库差异由 db 层的 Value/Cell 编解码抹平）。
/// 方法都接收当前连接 `&mut Conn`——事务边界由 service 层的 begin/finish 决定，
/// 仓储自身不开事务。

// ── users ───────────────────────────────────────────────────────────────────

fn map_user(row: &DbRow) -> ApiResult<User> {
    Ok(User {
        id: row.uuid("id")?,
        email: row.str("email")?,
        password_hash: row.str("password_hash")?,
        nickname: row.str("nickname")?,
        avatar_id: row.str("avatar_id")?,
        created_at: row.ts("created_at")?,
        updated_at: row.ts("updated_at")?,
    })
}

pub mod users {
    use super::*;

    pub async fn find_by_email(conn: &mut Conn, email: &str) -> ApiResult<Option<User>> {
        conn.fetch_opt("SELECT * FROM users WHERE email = ?", &[Value::Str(email.into())])
            .await?
            .map(|r| map_user(&r))
            .transpose()
    }

    pub async fn find_by_id(conn: &mut Conn, id: &Uuid) -> ApiResult<Option<User>> {
        conn.fetch_opt("SELECT * FROM users WHERE id = ?", &[Value::Uuid(*id)])
            .await?
            .map(|r| map_user(&r))
            .transpose()
    }

    pub async fn exists_by_email(conn: &mut Conn, email: &str) -> ApiResult<bool> {
        Ok(conn
            .fetch_opt("SELECT 1 FROM users WHERE email = ? LIMIT 1", &[Value::Str(email.into())])
            .await?
            .is_some())
    }

    pub async fn exists_by_nickname(conn: &mut Conn, nickname: &str) -> ApiResult<bool> {
        Ok(conn
            .fetch_opt(
                "SELECT 1 FROM users WHERE nickname = ? LIMIT 1",
                &[Value::Str(nickname.into())],
            )
            .await?
            .is_some())
    }

    pub async fn insert(conn: &mut Conn, user: &User) -> ApiResult<()> {
        conn.execute(
            "INSERT INTO users (id, email, password_hash, nickname, avatar_id, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            &[
                Value::Uuid(user.id),
                Value::Str(user.email.clone()),
                Value::Str(user.password_hash.clone()),
                Value::Str(user.nickname.clone()),
                Value::Str(user.avatar_id.clone()),
                Value::Ts(user.created_at),
                Value::Ts(user.updated_at),
            ],
        )
        .await?;
        Ok(())
    }

    pub async fn update_profile(
        conn: &mut Conn,
        id: &Uuid,
        nickname: &str,
        avatar_id: &str,
        now: &DateTime<Utc>,
    ) -> ApiResult<()> {
        conn.execute(
            "UPDATE users SET nickname = ?, avatar_id = ?, updated_at = ? WHERE id = ?",
            &[
                Value::Str(nickname.into()),
                Value::Str(avatar_id.into()),
                Value::Ts(*now),
                Value::Uuid(*id),
            ],
        )
        .await?;
        Ok(())
    }

    pub async fn update_password(
        conn: &mut Conn,
        id: &Uuid,
        password_hash: &str,
        now: &DateTime<Utc>,
    ) -> ApiResult<()> {
        conn.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            &[Value::Str(password_hash.into()), Value::Ts(*now), Value::Uuid(*id)],
        )
        .await?;
        Ok(())
    }
}

// ── capsules ────────────────────────────────────────────────────────────────

#[derive(Clone, Copy)]
pub enum PlazaSort {
    Hot,
    New,
}

#[derive(Clone, Copy)]
pub enum PlazaFilter {
    All,
    Opened,
    Unopened,
}

/// 联表查询的公共列：胶囊全列 + 创建者摘要。
const VIEW_COLUMNS: &str = "c.id, c.owner_id, c.code, c.title, c.content, c.open_at, c.in_plaza, \
     c.favorite_count, c.created_at, c.updated_at, \
     u.nickname AS owner_nickname, u.avatar_id AS owner_avatar_id";

fn map_view(row: &DbRow, favorited_column: bool, favorited_at_column: bool) -> ApiResult<CapsuleView> {
    let capsule = Capsule {
        id: row.uuid("id")?,
        owner_id: row.uuid("owner_id")?,
        code: row.str("code")?,
        title: row.str("title")?,
        content: row.str("content")?,
        open_at: row.ts("open_at")?,
        in_plaza: row.bool("in_plaza")?,
        favorite_count: row.i64("favorite_count")?,
        created_at: row.ts("created_at")?,
        updated_at: row.ts("updated_at")?,
    };
    Ok(CapsuleView {
        capsule,
        owner_nickname: row.str("owner_nickname")?,
        owner_avatar_id: row.str("owner_avatar_id")?,
        favorited_by_me: if favorited_column { row.bool("favorited_by_me")? } else { false },
        favorited_at: if favorited_at_column { row.ts_opt("favorited_at")? } else { None },
    })
}

pub mod capsules {
    use super::*;

    pub async fn find_by_code(conn: &mut Conn, code: &str) -> ApiResult<Option<CapsuleView>> {
        let sql = format!(
            "SELECT {VIEW_COLUMNS} FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.code = ?"
        );
        conn.fetch_opt(&sql, &[Value::Str(code.into())])
            .await?
            .map(|r| map_view(&r, false, false))
            .transpose()
    }

    pub async fn find_by_id(conn: &mut Conn, id: &Uuid) -> ApiResult<Option<CapsuleView>> {
        let sql = format!(
            "SELECT {VIEW_COLUMNS} FROM capsules c JOIN users u ON u.id = c.owner_id WHERE c.id = ?"
        );
        conn.fetch_opt(&sql, &[Value::Uuid(*id)])
            .await?
            .map(|r| map_view(&r, false, false))
            .transpose()
    }

    pub async fn exists_by_code(conn: &mut Conn, code: &str) -> ApiResult<bool> {
        Ok(conn
            .fetch_opt("SELECT 1 FROM capsules WHERE code = ? LIMIT 1", &[Value::Str(code.into())])
            .await?
            .is_some())
    }

    pub async fn insert(conn: &mut Conn, c: &Capsule) -> ApiResult<()> {
        conn.execute(
            "INSERT INTO capsules (id, owner_id, code, title, content, open_at, in_plaza, \
             favorite_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            &[
                Value::Uuid(c.id),
                Value::Uuid(c.owner_id),
                Value::Str(c.code.clone()),
                Value::Str(c.title.clone()),
                Value::Str(c.content.clone()),
                Value::Ts(c.open_at),
                Value::Bool(c.in_plaza),
                Value::I64(c.favorite_count),
                Value::Ts(c.created_at),
                Value::Ts(c.updated_at),
            ],
        )
        .await?;
        Ok(())
    }

    pub async fn delete(conn: &mut Conn, id: &Uuid) -> ApiResult<()> {
        conn.execute("DELETE FROM capsules WHERE id = ?", &[Value::Uuid(*id)]).await?;
        Ok(())
    }

    pub async fn increment_favorite_count(
        conn: &mut Conn,
        id: &Uuid,
        now: &DateTime<Utc>,
    ) -> ApiResult<()> {
        conn.execute(
            "UPDATE capsules SET favorite_count = favorite_count + 1, updated_at = ? WHERE id = ?",
            &[Value::Ts(*now), Value::Uuid(*id)],
        )
        .await?;
        Ok(())
    }

    pub async fn decrement_favorite_count(
        conn: &mut Conn,
        id: &Uuid,
        now: &DateTime<Utc>,
    ) -> ApiResult<()> {
        conn.execute(
            "UPDATE capsules SET favorite_count = favorite_count - 1, updated_at = ? \
             WHERE id = ? AND favorite_count > 0",
            &[Value::Ts(*now), Value::Uuid(*id)],
        )
        .await?;
        Ok(())
    }

    pub async fn favorite_count_of(conn: &mut Conn, id: &Uuid) -> ApiResult<i64> {
        match conn
            .fetch_opt("SELECT favorite_count FROM capsules WHERE id = ?", &[Value::Uuid(*id)])
            .await?
        {
            Some(row) => row.i64("favorite_count"),
            None => Ok(0),
        }
    }

    // ── 广场 ───────────────────────────────────────────────────────────────

    /// WHERE 子句公共部分：in_plaza + filter + q。
    fn plaza_conditions(
        sql: &mut String,
        params: &mut Vec<Value>,
        filter: PlazaFilter,
        now: &DateTime<Utc>,
        search: Option<&str>,
    ) {
        sql.push_str(" WHERE c.in_plaza = ?");
        params.push(Value::Bool(true));
        match filter {
            PlazaFilter::All => {}
            PlazaFilter::Opened => {
                sql.push_str(" AND c.open_at <= ?");
                params.push(Value::Ts(*now));
            }
            PlazaFilter::Unopened => {
                sql.push_str(" AND c.open_at > ?");
                params.push(Value::Ts(*now));
            }
        }
        if let Some(search) = search {
            let pattern = format!("%{search}%");
            sql.push_str(" AND (lower(c.title) LIKE ? OR lower(u.nickname) LIKE ?)");
            params.push(Value::Str(pattern.clone()));
            params.push(Value::Str(pattern));
        }
    }

    pub async fn count_plaza(
        conn: &mut Conn,
        filter: PlazaFilter,
        now: &DateTime<Utc>,
        search: Option<&str>,
    ) -> ApiResult<i64> {
        let mut sql =
            "SELECT COUNT(*) AS total FROM capsules c JOIN users u ON u.id = c.owner_id".to_string();
        let mut params = Vec::new();
        plaza_conditions(&mut sql, &mut params, filter, now, search);
        match conn.fetch_opt(&sql, &params).await? {
            Some(row) => row.i64("total"),
            None => Ok(0),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn find_plaza_page(
        conn: &mut Conn,
        filter: PlazaFilter,
        now: &DateTime<Utc>,
        search: Option<&str>,
        sort: PlazaSort,
        viewer_id: Option<&Uuid>,
        limit: i64,
        offset: i64,
    ) -> ApiResult<Vec<CapsuleView>> {
        let mut sql = format!("SELECT {VIEW_COLUMNS}, ");
        let mut params = Vec::new();
        if let Some(viewer_id) = viewer_id {
            sql.push_str(
                "(fv.user_id IS NOT NULL) AS favorited_by_me \
                 FROM capsules c JOIN users u ON u.id = c.owner_id \
                 LEFT JOIN favorites fv ON fv.capsule_id = c.id AND fv.user_id = ?",
            );
            params.push(Value::Uuid(*viewer_id));
        } else {
            sql.push_str(
                "(1 = 0) AS favorited_by_me FROM capsules c JOIN users u ON u.id = c.owner_id",
            );
        }
        plaza_conditions(&mut sql, &mut params, filter, now, search);
        match sort {
            PlazaSort::Hot => sql.push_str(" ORDER BY c.favorite_count DESC, c.created_at DESC"),
            PlazaSort::New => sql.push_str(" ORDER BY c.created_at DESC"),
        }
        sql.push_str(" LIMIT ? OFFSET ?");
        params.push(Value::I64(limit));
        params.push(Value::I64(offset));
        conn.fetch_all(&sql, &params)
            .await?
            .iter()
            .map(|r| map_view(r, true, false))
            .collect()
    }

    // ── 我创建的 ───────────────────────────────────────────────────────────

    pub async fn count_by_owner(conn: &mut Conn, owner_id: &Uuid) -> ApiResult<i64> {
        match conn
            .fetch_opt(
                "SELECT COUNT(*) AS total FROM capsules WHERE owner_id = ?",
                &[Value::Uuid(*owner_id)],
            )
            .await?
        {
            Some(row) => row.i64("total"),
            None => Ok(0),
        }
    }

    pub async fn find_by_owner_page(
        conn: &mut Conn,
        owner_id: &Uuid,
        limit: i64,
        offset: i64,
    ) -> ApiResult<Vec<CapsuleView>> {
        let sql = format!(
            "SELECT {VIEW_COLUMNS} FROM capsules c JOIN users u ON u.id = c.owner_id \
             WHERE c.owner_id = ? ORDER BY c.created_at DESC LIMIT ? OFFSET ?"
        );
        conn.fetch_all(&sql, &[Value::Uuid(*owner_id), Value::I64(limit), Value::I64(offset)])
            .await?
            .iter()
            .map(|r| map_view(r, false, false))
            .collect()
    }

    // ── 我收藏的 ───────────────────────────────────────────────────────────

    pub async fn count_favorites_by_user(conn: &mut Conn, user_id: &Uuid) -> ApiResult<i64> {
        match conn
            .fetch_opt(
                "SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?",
                &[Value::Uuid(*user_id)],
            )
            .await?
        {
            Some(row) => row.i64("total"),
            None => Ok(0),
        }
    }

    pub async fn find_favorites_page(
        conn: &mut Conn,
        user_id: &Uuid,
        limit: i64,
        offset: i64,
    ) -> ApiResult<Vec<CapsuleView>> {
        let sql = format!(
            "SELECT {VIEW_COLUMNS}, fv.created_at AS favorited_at \
             FROM favorites fv JOIN capsules c ON c.id = fv.capsule_id \
             JOIN users u ON u.id = c.owner_id \
             WHERE fv.user_id = ? ORDER BY fv.created_at DESC LIMIT ? OFFSET ?"
        );
        conn.fetch_all(&sql, &[Value::Uuid(*user_id), Value::I64(limit), Value::I64(offset)])
            .await?
            .iter()
            .map(|r| {
                let mut view = map_view(r, false, true)?;
                view.favorited_by_me = true;
                Ok(view)
            })
            .collect()
    }
}

// ── favorites ───────────────────────────────────────────────────────────────

pub mod favorites {
    use super::*;

    pub async fn find(
        conn: &mut Conn,
        user_id: &Uuid,
        capsule_id: &Uuid,
    ) -> ApiResult<Option<DateTime<Utc>>> {
        match conn
            .fetch_opt(
                "SELECT created_at FROM favorites WHERE user_id = ? AND capsule_id = ?",
                &[Value::Uuid(*user_id), Value::Uuid(*capsule_id)],
            )
            .await?
        {
            Some(row) => Ok(Some(row.ts("created_at")?)),
            None => Ok(None),
        }
    }

    pub async fn exists(conn: &mut Conn, user_id: &Uuid, capsule_id: &Uuid) -> ApiResult<bool> {
        Ok(find(conn, user_id, capsule_id).await?.is_some())
    }

    /// 幂等插入：已存在时不报错。返回是否真的插入了新行。
    /// PG / SQLite（≥3.35）的 UPSERT + RETURNING 语法一致。
    pub async fn insert_ignore(
        conn: &mut Conn,
        user_id: &Uuid,
        capsule_id: &Uuid,
        now: &DateTime<Utc>,
    ) -> ApiResult<bool> {
        Ok(conn
            .fetch_opt(
                "INSERT INTO favorites (user_id, capsule_id, created_at) VALUES (?, ?, ?) \
                 ON CONFLICT (user_id, capsule_id) DO NOTHING RETURNING created_at",
                &[Value::Uuid(*user_id), Value::Uuid(*capsule_id), Value::Ts(*now)],
            )
            .await?
            .is_some())
    }

    /// 幂等删除：返回是否真的删除了行。
    pub async fn delete(conn: &mut Conn, user_id: &Uuid, capsule_id: &Uuid) -> ApiResult<bool> {
        Ok(conn
            .fetch_opt(
                "DELETE FROM favorites WHERE user_id = ? AND capsule_id = ? RETURNING created_at",
                &[Value::Uuid(*user_id), Value::Uuid(*capsule_id)],
            )
            .await?
            .is_some())
    }

    pub async fn delete_by_capsule(conn: &mut Conn, capsule_id: &Uuid) -> ApiResult<()> {
        conn.execute("DELETE FROM favorites WHERE capsule_id = ?", &[Value::Uuid(*capsule_id)])
            .await?;
        Ok(())
    }
}

// ── refresh_tokens ──────────────────────────────────────────────────────────

fn map_refresh(row: &DbRow) -> ApiResult<RefreshTokenRow> {
    Ok(RefreshTokenRow {
        id: row.uuid("id")?,
        user_id: row.uuid("user_id")?,
        token_hash: row.str("token_hash")?,
        family_id: row.uuid("family_id")?,
        expires_at: row.ts("expires_at")?,
        created_at: row.ts("created_at")?,
        revoked_at: row.ts_opt("revoked_at")?,
    })
}

pub mod refresh_tokens {
    use super::*;

    /// Postgres 路径加 FOR UPDATE 行锁，防止并发刷新双花；SQLite 单连接天然串行。
    pub async fn find_by_token_hash_for_update(
        conn: &mut Conn,
        token_hash: &str,
    ) -> ApiResult<Option<RefreshTokenRow>> {
        let mut sql = "SELECT * FROM refresh_tokens WHERE token_hash = ?".to_string();
        if !conn.is_sqlite() {
            sql.push_str(" FOR UPDATE");
        }
        conn.fetch_opt(&sql, &[Value::Str(token_hash.into())])
            .await?
            .map(|r| map_refresh(&r))
            .transpose()
    }

    pub async fn find_by_token_hash(
        conn: &mut Conn,
        token_hash: &str,
    ) -> ApiResult<Option<RefreshTokenRow>> {
        conn.fetch_opt(
            "SELECT * FROM refresh_tokens WHERE token_hash = ?",
            &[Value::Str(token_hash.into())],
        )
        .await?
        .map(|r| map_refresh(&r))
        .transpose()
    }

    pub async fn insert(conn: &mut Conn, token: &RefreshTokenRow) -> ApiResult<()> {
        conn.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, created_at, revoked_at) \
             VALUES (?, ?, ?, ?, ?, ?, NULL)",
            &[
                Value::Uuid(token.id),
                Value::Uuid(token.user_id),
                Value::Str(token.token_hash.clone()),
                Value::Uuid(token.family_id),
                Value::Ts(token.expires_at),
                Value::Ts(token.created_at),
            ],
        )
        .await?;
        Ok(())
    }

    pub async fn mark_revoked(conn: &mut Conn, id: &Uuid, now: &DateTime<Utc>) -> ApiResult<()> {
        conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
            &[Value::Ts(*now), Value::Uuid(*id)],
        )
        .await?;
        Ok(())
    }

    pub async fn revoke_family(
        conn: &mut Conn,
        family_id: &Uuid,
        now: &DateTime<Utc>,
    ) -> ApiResult<()> {
        conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL",
            &[Value::Ts(*now), Value::Uuid(*family_id)],
        )
        .await?;
        Ok(())
    }

    pub async fn revoke_user(conn: &mut Conn, user_id: &Uuid, now: &DateTime<Utc>) -> ApiResult<()> {
        conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            &[Value::Ts(*now), Value::Uuid(*user_id)],
        )
        .await?;
        Ok(())
    }
}
