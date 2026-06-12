use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use sqlx::pool::PoolConnection;
use sqlx::postgres::{PgPool, PgPoolOptions, PgRow};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions, SqliteRow};
use sqlx::{Column, Row as SqlxRow, TypeInfo, ValueRef};
use uuid::Uuid;

use crate::config::AppConfig;
use crate::infra::iso_date;
use crate::web::error::{ApiError, ApiResult};

/// 跨库数据访问入口：PostgreSQL（连接池）与 SQLite（池上限 1，天然串行）
/// 统一为 `acquire() -> Conn`，业务 SQL 只写一份（`?` 占位，PG 端自动转 `$n`）。
///
/// - **绑定**：`Value` 枚举在绑定时按驱动分流——SQLite 存 32 位 hex UUID、
///   ISO-8601 TEXT 时间戳、0/1 整数；Postgres 用原生 uuid / timestamptz / boolean。
/// - **读取**：行解码成驱动无关的 `Cell`，访问器按实际存储形态还原领域类型。
/// - 每个 service 公共方法应只 acquire 一次连接，事务用 begin/finish 包裹；
///   不可同时持有两个连接（SQLite 池上限 1 会饿死）。
pub struct Db {
    pub is_sqlite: bool,
    pg: Option<PgPool>,
    lite: Option<SqlitePool>,
}

impl Db {
    pub fn connect(config: &AppConfig) -> ApiResult<Db> {
        if config.is_sqlite() {
            let path = sqlite_path(config);
            if let Some(dir) = std::path::Path::new(&path).parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let opts = SqliteConnectOptions::new()
                .filename(&path)
                .create_if_missing(true)
                .busy_timeout(Duration::from_secs(5))
                .foreign_keys(true);
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect_lazy_with(opts);
            Ok(Db { is_sqlite: true, pg: None, lite: Some(pool) })
        } else {
            let url = config.db_url.clone().unwrap_or_else(|| {
                "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro".to_string()
            });
            let pool = PgPoolOptions::new()
                .max_connections(8)
                .connect_lazy(&url)
                .map_err(|e| ApiError::internal(format!("非法 DB_URL: {e}")))?;
            Ok(Db { is_sqlite: false, pg: Some(pool), lite: None })
        }
    }

    pub async fn acquire(&self) -> ApiResult<Conn> {
        if self.is_sqlite {
            let conn = self.lite.as_ref().unwrap().acquire().await
                .map_err(|e| ApiError::internal(format!("获取 SQLite 连接失败: {e}")))?;
            Ok(Conn::Lite(conn))
        } else {
            let conn = self.pg.as_ref().unwrap().acquire().await
                .map_err(|e| ApiError::internal(format!("获取 PostgreSQL 连接失败: {e}")))?;
            Ok(Conn::Pg(conn))
        }
    }

    /// acquire + BEGIN（SQLite 用 BEGIN IMMEDIATE 抢写锁，避免升级死锁）。
    pub async fn begin(&self) -> ApiResult<Conn> {
        let mut conn = self.acquire().await?;
        let stmt = if self.is_sqlite { "BEGIN IMMEDIATE" } else { "BEGIN" };
        conn.execute(stmt, &[]).await?;
        Ok(conn)
    }
}

fn sqlite_path(config: &AppConfig) -> String {
    if let Some(url) = &config.db_url {
        if let Some(rest) = url.strip_prefix("sqlite://") {
            return rest.to_string(); // sqlite:///abs/path → /abs/path
        }
    }
    format!("{}/data/sqlite/hellotime-axum.db", config.abs_repo_root())
}

// ── 连接与查询原语 ───────────────────────────────────────────────────────────

pub enum Conn {
    Pg(PoolConnection<sqlx::Postgres>),
    Lite(PoolConnection<sqlx::Sqlite>),
}

/// 绑定值：业务层只描述语义类型，驱动差异在 bind 时分流。
#[derive(Clone, Debug)]
pub enum Value {
    Uuid(Uuid),
    Ts(DateTime<Utc>),
    Bool(bool),
    I64(i64),
    Str(String),
}

/// 读取值：行解码的驱动无关形态。
#[derive(Clone, Debug)]
pub enum Cell {
    Null,
    I64(i64),
    F64(f64),
    Str(String),
    Bool(bool),
    Uuid(Uuid),
    Ts(DateTime<Utc>),
}

pub struct DbRow(HashMap<String, Cell>);

impl Conn {
    pub fn is_sqlite(&self) -> bool {
        matches!(self, Conn::Lite(_))
    }

    pub async fn fetch_all(&mut self, sql: &str, params: &[Value]) -> ApiResult<Vec<DbRow>> {
        match self {
            Conn::Pg(conn) => {
                let sql_pg = to_pg_placeholders(sql);
                let mut q = sqlx::query(&sql_pg);
                for p in params {
                    q = match p {
                        Value::Uuid(u) => q.bind(*u),
                        Value::Ts(t) => q.bind(*t),
                        Value::Bool(b) => q.bind(*b),
                        Value::I64(i) => q.bind(*i),
                        Value::Str(s) => q.bind(s.clone()),
                    };
                }
                let rows = q.fetch_all(&mut **conn).await.map_err(db_err)?;
                rows.iter().map(decode_pg_row).collect()
            }
            Conn::Lite(conn) => {
                let mut q = sqlx::query(sql);
                for p in params {
                    q = match p {
                        Value::Uuid(u) => q.bind(uuid_hex(u)),
                        Value::Ts(t) => q.bind(iso_date::sqlite_string(t)),
                        Value::Bool(b) => q.bind(if *b { 1i64 } else { 0i64 }),
                        Value::I64(i) => q.bind(*i),
                        Value::Str(s) => q.bind(s.clone()),
                    };
                }
                let rows = q.fetch_all(&mut **conn).await.map_err(db_err)?;
                rows.iter().map(decode_sqlite_row).collect()
            }
        }
    }

    pub async fn fetch_opt(&mut self, sql: &str, params: &[Value]) -> ApiResult<Option<DbRow>> {
        Ok(self.fetch_all(sql, params).await?.into_iter().next())
    }

    pub async fn execute(&mut self, sql: &str, params: &[Value]) -> ApiResult<u64> {
        match self {
            Conn::Pg(conn) => {
                let sql_pg = to_pg_placeholders(sql);
                let mut q = sqlx::query(&sql_pg);
                for p in params {
                    q = match p {
                        Value::Uuid(u) => q.bind(*u),
                        Value::Ts(t) => q.bind(*t),
                        Value::Bool(b) => q.bind(*b),
                        Value::I64(i) => q.bind(*i),
                        Value::Str(s) => q.bind(s.clone()),
                    };
                }
                Ok(q.execute(&mut **conn).await.map_err(db_err)?.rows_affected())
            }
            Conn::Lite(conn) => {
                let mut q = sqlx::query(sql);
                for p in params {
                    q = match p {
                        Value::Uuid(u) => q.bind(uuid_hex(u)),
                        Value::Ts(t) => q.bind(iso_date::sqlite_string(t)),
                        Value::Bool(b) => q.bind(if *b { 1i64 } else { 0i64 }),
                        Value::I64(i) => q.bind(*i),
                        Value::Str(s) => q.bind(s.clone()),
                    };
                }
                Ok(q.execute(&mut **conn).await.map_err(db_err)?.rows_affected())
            }
        }
    }

    /// 事务收尾：Ok → COMMIT，Err → ROLLBACK（忽略回滚自身的错误）。
    /// 消费连接，归还池子；refresh 重用检测等"先提交再抛错"场景由调用方
    /// 把业务分支编码进 Ok 值（outcome 枚举），commit 后再转为错误。
    pub async fn finish<T>(mut self, result: ApiResult<T>) -> ApiResult<T> {
        match result {
            Ok(v) => {
                self.execute("COMMIT", &[]).await?;
                Ok(v)
            }
            Err(e) => {
                let _ = self.execute("ROLLBACK", &[]).await;
                Err(e)
            }
        }
    }
}

fn db_err(e: sqlx::Error) -> ApiError {
    ApiError::internal(format!("数据库错误: {e}"))
}

/// `?` 占位转 PG `$1..$n`。约定：业务 SQL 不含字面 `?`（所有值都走绑定）。
fn to_pg_placeholders(sql: &str) -> String {
    let mut out = String::with_capacity(sql.len() + 8);
    let mut n = 0;
    for ch in sql.chars() {
        if ch == '?' {
            n += 1;
            out.push('$');
            out.push_str(&n.to_string());
        } else {
            out.push(ch);
        }
    }
    out
}

fn decode_pg_row(row: &PgRow) -> ApiResult<DbRow> {
    let mut map = HashMap::new();
    for (i, col) in row.columns().iter().enumerate() {
        let raw = row.try_get_raw(i).map_err(db_err)?;
        let cell = if raw.is_null() {
            Cell::Null
        } else {
            match raw.type_info().name() {
                "UUID" => Cell::Uuid(row.try_get(i).map_err(db_err)?),
                "TIMESTAMPTZ" => Cell::Ts(row.try_get(i).map_err(db_err)?),
                "BOOL" => Cell::Bool(row.try_get(i).map_err(db_err)?),
                "INT2" => Cell::I64(row.try_get::<i16, _>(i).map_err(db_err)? as i64),
                "INT4" => Cell::I64(row.try_get::<i32, _>(i).map_err(db_err)? as i64),
                "INT8" => Cell::I64(row.try_get::<i64, _>(i).map_err(db_err)?),
                "FLOAT4" => Cell::F64(row.try_get::<f32, _>(i).map_err(db_err)? as f64),
                "FLOAT8" => Cell::F64(row.try_get::<f64, _>(i).map_err(db_err)?),
                _ => Cell::Str(row.try_get(i).map_err(db_err)?),
            }
        };
        map.insert(col.name().to_string(), cell);
    }
    Ok(DbRow(map))
}

fn decode_sqlite_row(row: &SqliteRow) -> ApiResult<DbRow> {
    let mut map = HashMap::new();
    for (i, col) in row.columns().iter().enumerate() {
        let raw = row.try_get_raw(i).map_err(db_err)?;
        let cell = if raw.is_null() {
            Cell::Null
        } else {
            // SQLite 按值的实际存储类解码（列声明类型对表达式不可靠）。
            match raw.type_info().name() {
                "INTEGER" => Cell::I64(row.try_get(i).map_err(db_err)?),
                "REAL" => Cell::F64(row.try_get(i).map_err(db_err)?),
                _ => Cell::Str(row.try_get(i).map_err(db_err)?),
            }
        };
        map.insert(col.name().to_string(), cell);
    }
    Ok(DbRow(map))
}

// ── 行访问器：按 Cell 实际形态还原领域类型 ──────────────────────────────────

impl DbRow {
    fn cell(&self, column: &str) -> ApiResult<&Cell> {
        self.0
            .get(column)
            .ok_or_else(|| ApiError::internal(format!("缺少列: {column}")))
    }

    pub fn str(&self, column: &str) -> ApiResult<String> {
        match self.cell(column)? {
            Cell::Str(s) => Ok(s.clone()),
            other => Err(ApiError::internal(format!("列 {column} 不是文本: {other:?}"))),
        }
    }

    pub fn i64(&self, column: &str) -> ApiResult<i64> {
        match self.cell(column)? {
            Cell::I64(i) => Ok(*i),
            Cell::F64(f) => Ok(*f as i64),
            other => Err(ApiError::internal(format!("列 {column} 不是整数: {other:?}"))),
        }
    }

    pub fn bool(&self, column: &str) -> ApiResult<bool> {
        match self.cell(column)? {
            Cell::Bool(b) => Ok(*b),
            Cell::I64(i) => Ok(*i != 0),
            other => Err(ApiError::internal(format!("列 {column} 不是布尔: {other:?}"))),
        }
    }

    pub fn uuid(&self, column: &str) -> ApiResult<Uuid> {
        match self.cell(column)? {
            Cell::Uuid(u) => Ok(*u),
            Cell::Str(s) => parse_uuid(s)
                .ok_or_else(|| ApiError::internal(format!("非法 UUID 列值: {column}"))),
            other => Err(ApiError::internal(format!("列 {column} 不是 UUID: {other:?}"))),
        }
    }

    pub fn ts(&self, column: &str) -> ApiResult<DateTime<Utc>> {
        match self.cell(column)? {
            Cell::Ts(t) => Ok(*t),
            Cell::Str(s) => iso_date::parse(s)
                .ok_or_else(|| ApiError::internal(format!("非法时间列值: {column}"))),
            other => Err(ApiError::internal(format!("列 {column} 不是时间: {other:?}"))),
        }
    }

    pub fn ts_opt(&self, column: &str) -> ApiResult<Option<DateTime<Utc>>> {
        match self.cell(column)? {
            Cell::Null => Ok(None),
            _ => Ok(Some(self.ts(column)?)),
        }
    }
}

// ── UUID 编解码 ─────────────────────────────────────────────────────────────

/// SQLite 存 32 位无横线 hex（与 seed 及其它栈对齐）。
pub fn uuid_hex(u: &Uuid) -> String {
    u.simple().to_string()
}

/// 宽松解析 UUID：接受 32 位 hex 或 36 位带横线；非法返回 None（调用方据此转 404）。
pub fn parse_uuid(raw: &str) -> Option<Uuid> {
    Uuid::parse_str(raw.trim()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_hex_round_trip() {
        let u = Uuid::new_v4();
        let hex = uuid_hex(&u);
        assert_eq!(hex.len(), 32);
        assert!(!hex.contains('-'));
        assert_eq!(parse_uuid(&hex), Some(u));
        assert_eq!(parse_uuid(&u.to_string()), Some(u));
    }

    #[test]
    fn parse_uuid_rejects_garbage() {
        assert!(parse_uuid("not-a-uuid").is_none());
        assert!(parse_uuid("12345").is_none());
    }

    #[test]
    fn pg_placeholder_conversion() {
        assert_eq!(
            to_pg_placeholders("SELECT * FROM t WHERE a = ? AND b = ?"),
            "SELECT * FROM t WHERE a = $1 AND b = $2"
        );
        assert_eq!(to_pg_placeholders("SELECT 1"), "SELECT 1");
    }
}
