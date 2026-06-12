use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde_json::json;

use crate::services::{auth as auth_service, capsule, favorite, plaza, recommendation, suggestion, user as user_service};
use crate::state::AppState;
use crate::web::auth::{optional_user, required_user};
use crate::web::envelope;
use crate::web::error::{ApiError, ApiResult};
use crate::web::requests::*;

/// 路由注册：presentation 层只做参数提取 + 调 service + 包 Envelope。
pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        // ── 静态资源：头像 / 技术栈图标（相对仓库根的 spec/ 目录） ──────────
        .route("/static/avatars/{file}", get(serve_avatar))
        .route("/static/icons/{file}", get(serve_icon))
        // ── Health / Avatars ────────────────────────────────────────────────
        .route("/api/v1/health", get(health))
        .route("/api/v1/avatars", get(avatars_list))
        // ── Auth ────────────────────────────────────────────────────────────
        .route("/api/v1/auth/register", post(register))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/refresh", post(refresh))
        .route("/api/v1/auth/logout", post(logout))
        // ── Me ──────────────────────────────────────────────────────────────
        .route("/api/v1/me", get(me).patch(update_profile))
        .route("/api/v1/me/password", post(change_password))
        .route("/api/v1/me/capsules", get(my_capsules))
        .route("/api/v1/me/capsules/{id}", delete(delete_capsule))
        // ── Capsules ────────────────────────────────────────────────────────
        .route("/api/v1/capsules", post(create_capsule))
        .route("/api/v1/capsules/{code}", get(get_by_code))
        // ── Plaza ───────────────────────────────────────────────────────────
        .route("/api/v1/plaza/capsules", get(plaza_list))
        .route("/api/v1/plaza/capsules/{id}", get(plaza_detail))
        // ── Favorites ───────────────────────────────────────────────────────
        .route("/api/v1/me/favorites", get(my_favorites).post(add_favorite))
        .route("/api/v1/me/favorites/{capsuleId}", delete(remove_favorite))
        // ── AI 建议 / 推荐 ──────────────────────────────────────────────────
        .route("/api/v1/capsule-suggestion", post(capsule_suggestion))
        .route("/api/v1/capsule-recommendations", get(capsule_recommendations))
        .fallback(fallback_404)
        .with_state(state)
}

type S = State<Arc<AppState>>;
type Q = Query<HashMap<String, String>>;

/// 请求体解码失败（坏 JSON / 字段类型不符）→ 422 VALIDATION_ERROR。
fn body<T>(r: Result<Json<T>, JsonRejection>) -> ApiResult<T> {
    r.map(|Json(v)| v).map_err(|_| ApiError::invalid_body())
}

/// 缺失才用默认值；存在但非整数 → 422（对齐 openapi 的 integer 约束）。
fn int_param(q: &HashMap<String, String>, name: &str, fallback: i64) -> ApiResult<i64> {
    match q.get(name) {
        None => Ok(fallback),
        Some(raw) => raw
            .parse()
            .map_err(|_| ApiError::validation(format!("{name} 必须是整数"), name)),
    }
}

async fn fallback_404() -> ApiError {
    ApiError::not_found("资源不存在")
}

// ── Health / Avatars ────────────────────────────────────────────────────────

async fn health(State(state): S) -> Response {
    let is_sqlite = state.db.is_sqlite;
    let summary = "基于 Rust + Axum 的服务端实现。Tokio 异步运行时承载 HTTP，async/await 全链路异步，\
        sqlx 手写参数化 SQL 同时驱动 PostgreSQL（连接池）与 SQLite（池上限 1 天然串行）。\
        跨库差异收敛在一个值编解码层：SQLite 存 32 位 hex UUID 与 ISO-8601 TEXT 时间戳，\
        Postgres 用原生 uuid/timestamptz。JWT（HS256）手写签发校验 + refresh token 轮转与家族吊销实现鉴权；\
        幂等 UPSERT + 原子自增维护收藏计数；serde_json 树显式输出契约要求的 null 字段；\
        业务错误实现 IntoResponse，统一转换为契约约定的错误响应外壳。";
    let db_item = if is_sqlite {
        json!({"role": "database", "name": "SQLite", "version": "3", "iconUrl": "/static/icons/sqlite.svg"})
    } else {
        json!({"role": "database", "name": "PostgreSQL", "version": "16", "iconUrl": "/static/icons/postgresql.svg"})
    };
    envelope::ok(json!({
        "status": "ok",
        "service": state.config.service_name,
        "version": state.config.service_version,
        "uptimeSeconds": state.start_time.elapsed().as_secs(),
        "stack": {
            "kind": "backend",
            "summary": summary,
            "items": [
                {"role": "language", "name": "Rust", "version": "1.94", "iconUrl": "/static/icons/rust.svg"},
                {"role": "framework", "name": "Axum", "version": "0.8", "iconUrl": "/static/icons/axum.svg"},
                {"role": "runtime", "name": "Tokio", "version": "1", "iconUrl": "/static/icons/rust.svg"},
                db_item,
            ],
        },
    }))
}

async fn avatars_list(State(state): S) -> Response {
    envelope::ok(state.avatars.list())
}

// ── Auth ────────────────────────────────────────────────────────────────────

async fn register(
    State(state): S,
    payload: Result<Json<RegisterRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let req = body(payload)?;
    Ok(envelope::ok_with(StatusCode::CREATED, auth_service::register(&state, &req).await?))
}

async fn login(
    State(state): S,
    payload: Result<Json<LoginRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let req = body(payload)?;
    Ok(envelope::ok(auth_service::login(&state, &req).await?))
}

async fn refresh(
    State(state): S,
    payload: Result<Json<RefreshRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let req = body(payload)?;
    Ok(envelope::ok(auth_service::refresh(&state, req.refresh_token.as_deref()).await?))
}

async fn logout(
    State(state): S,
    payload: Result<Json<LogoutRequest>, JsonRejection>,
) -> ApiResult<Response> {
    // 登出宽容处理：缺失/坏请求体一律视为无 token，仍然 204。
    let token = payload.ok().and_then(|Json(b)| b.refresh_token);
    auth_service::logout(&state, token.as_deref()).await?;
    Ok(envelope::no_content())
}

// ── Me ──────────────────────────────────────────────────────────────────────

async fn me(State(state): S, headers: HeaderMap) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    Ok(envelope::ok(user_service::to_json(&user)))
}

async fn update_profile(
    State(state): S,
    headers: HeaderMap,
    payload: Result<Json<UpdateProfileRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    let req = body(payload)?;
    Ok(envelope::ok(user_service::update_profile(&state, &user, &req).await?))
}

async fn change_password(
    State(state): S,
    headers: HeaderMap,
    payload: Result<Json<ChangePasswordRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    let req = body(payload)?;
    auth_service::change_password(&state, &user, &req).await?;
    Ok(envelope::no_content())
}

async fn my_capsules(State(state): S, headers: HeaderMap, Query(q): Q) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    let page = int_param(&q, "page", 1)?;
    let page_size = int_param(&q, "pageSize", 20)?;
    Ok(envelope::ok(plaza::my_capsules(&state, &user, page, page_size).await?))
}

async fn delete_capsule(
    State(state): S,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    capsule::delete_own(&state, &user, &id).await?;
    Ok(envelope::no_content())
}

// ── Capsules ────────────────────────────────────────────────────────────────

async fn create_capsule(
    State(state): S,
    headers: HeaderMap,
    payload: Result<Json<CreateCapsuleRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    let req = body(payload)?;
    Ok(envelope::ok_with(StatusCode::CREATED, capsule::create(&state, &user, &req).await?))
}

async fn get_by_code(
    State(state): S,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> ApiResult<Response> {
    let viewer = optional_user(&state, &headers).await?;
    Ok(envelope::ok(
        capsule::get_by_code(&state, &code, viewer.as_ref().map(|u| &u.id)).await?,
    ))
}

// ── Plaza ───────────────────────────────────────────────────────────────────

async fn plaza_list(State(state): S, headers: HeaderMap, Query(q): Q) -> ApiResult<Response> {
    let viewer = optional_user(&state, &headers).await?;
    let page = int_param(&q, "page", 1)?;
    let page_size = int_param(&q, "pageSize", 20)?;
    Ok(envelope::ok(
        plaza::plaza_list(
            &state,
            q.get("sort").map(|s| s.as_str()).unwrap_or("new"),
            q.get("filter").map(|s| s.as_str()).unwrap_or("all"),
            q.get("q").map(|s| s.as_str()),
            page,
            page_size,
            viewer.as_ref().map(|u| &u.id),
        )
        .await?,
    ))
}

async fn plaza_detail(
    State(state): S,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    let viewer = optional_user(&state, &headers).await?;
    Ok(envelope::ok(
        capsule::get_plaza_detail(&state, &id, viewer.as_ref().map(|u| &u.id)).await?,
    ))
}

// ── Favorites ───────────────────────────────────────────────────────────────

async fn my_favorites(State(state): S, headers: HeaderMap, Query(q): Q) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    let page = int_param(&q, "page", 1)?;
    let page_size = int_param(&q, "pageSize", 20)?;
    Ok(envelope::ok(plaza::my_favorites(&state, &user, page, page_size).await?))
}

async fn add_favorite(
    State(state): S,
    headers: HeaderMap,
    payload: Result<Json<FavoriteRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    let req = body(payload)?;
    Ok(envelope::ok(
        favorite::add_favorite(&state, &user, req.capsule_id.as_deref()).await?,
    ))
}

async fn remove_favorite(
    State(state): S,
    headers: HeaderMap,
    Path(capsule_id): Path<String>,
) -> ApiResult<Response> {
    let user = required_user(&state, &headers).await?;
    favorite::remove_favorite(&state, &user, &capsule_id).await?;
    Ok(envelope::no_content())
}

// ── AI 建议 / 推荐 ──────────────────────────────────────────────────────────

async fn capsule_suggestion(
    State(state): S,
    payload: Result<Json<CapsuleSuggestionRequest>, JsonRejection>,
) -> ApiResult<Response> {
    let req = body(payload)?;
    Ok(envelope::ok(suggestion::suggest(&state, &req).await?))
}

async fn capsule_recommendations(State(state): S, Query(q): Q) -> ApiResult<Response> {
    let count = match q.get("count") {
        None => 4,
        Some(raw) => match raw.parse::<i64>() {
            Ok(n) if (3..=8).contains(&n) => n,
            _ => return Err(ApiError::validation("count 必须是 [3, 8] 范围内的整数", "count")),
        },
    };
    let locale = q.get("locale").map(|s| s.as_str()).unwrap_or("zh-CN");
    Ok(envelope::ok(recommendation::get_recommendations(&state, count, locale).await))
}

// ── 静态资源 ─────────────────────────────────────────────────────────────────

async fn serve_avatar(State(state): S, Path(file): Path<String>) -> ApiResult<Response> {
    serve_spec_file(&state, "spec/avatars", &file).await
}

async fn serve_icon(State(state): S, Path(file): Path<String>) -> ApiResult<Response> {
    serve_spec_file(&state, "spec/icons", &file).await
}

/// 提供 spec/ 下的静态 SVG（路径白名单 + 文件名防穿越）。
async fn serve_spec_file(state: &AppState, subdir: &str, file: &str) -> ApiResult<Response> {
    if file.contains("..") || file.contains('/') {
        return Err(ApiError::not_found("文件不存在"));
    }
    let path = format!("{}/{subdir}/{file}", state.config.abs_repo_root());
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|_| ApiError::not_found("文件不存在"))?;
    let content_type = if file.ends_with(".svg") {
        "image/svg+xml"
    } else if file.ends_with(".json") {
        "application/json"
    } else {
        "application/octet-stream"
    };
    Ok(axum::response::Response::builder()
        .status(StatusCode::OK)
        .header("content-type", content_type)
        .body(axum::body::Body::from(bytes))
        .map_err(|e| ApiError::internal(format!("构建响应失败: {e}")))?)
}
