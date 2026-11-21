use chrono::Utc;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::domain::User;
use crate::infra::iso_date;
use crate::infra::repos::{capsules, PlazaFilter, PlazaSort};
use crate::services::{mapper, validation};
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};

/// 广场列表 / 我创建的 / 我收藏的（分页查询）。对应 Vapor 的 PlazaService。

#[allow(clippy::too_many_arguments)]
pub async fn plaza_list(
    state: &AppState,
    sort: &str,
    filter: &str,
    q: Option<&str>,
    page: i64,
    page_size: i64,
    viewer_id: Option<&Uuid>,
) -> ApiResult<Value> {
    validation::page(page, page_size)?;
    let plaza_sort = match sort {
        "hot" => PlazaSort::Hot,
        "new" => PlazaSort::New,
        _ => return Err(ApiError::validation("sort 仅支持 hot/new", "sort")),
    };
    let plaza_filter = match filter {
        "all" => PlazaFilter::All,
        "opened" => PlazaFilter::Opened,
        "unopened" => PlazaFilter::Unopened,
        _ => return Err(ApiError::validation("filter 仅支持 all/opened/unopened", "filter")),
    };
    let search = search_term(q)?;
    let now = Utc::now();

    let mut conn = state.db.acquire().await?;
    let total =
        capsules::count_plaza(&mut conn, plaza_filter, &now, search.as_deref()).await?;
    let rows = capsules::find_plaza_page(
        &mut conn,
        plaza_filter,
        &now,
        search.as_deref(),
        plaza_sort,
        viewer_id,
        page_size,
        (page - 1) * page_size,
    )
    .await?;
    Ok(mapper::paginated(
        rows.iter().map(|v| mapper::list_item(v, &now)).collect(),
        total,
        page,
        page_size,
    ))
}

fn search_term(raw: Option<&str>) -> ApiResult<Option<String>> {
    let Some(trimmed) = raw.map(str::trim).filter(|term| !term.is_empty()) else {
        return Ok(None);
    };
    if trimmed.chars().count() > 50 {
        return Err(ApiError::validation("q 长度不得超过 50", "q"));
    }
    Ok(Some(trimmed.to_lowercase()))
}

pub async fn plaza_stats(state: &AppState, raw_search: Option<&str>) -> ApiResult<Value> {
    let search = search_term(raw_search)?;
    let now = Utc::now();
    let mut conn = state.db.acquire().await?;
    let counts = capsules::plaza_counts(&mut conn, &now, search.as_deref()).await?;
    let farthest = capsules::farthest_open_at(&mut conn).await?;
    let next = capsules::next_open_at(&mut conn, &now).await?;
    Ok(json!({
        "counts": {"all": counts.all, "opened": counts.opened, "unopened": counts.unopened},
        "farthestOpenAt": farthest.as_ref().map(iso_date::json_string),
        "nextOpenAt": next.as_ref().map(iso_date::json_string),
    }))
}

pub async fn my_stats(state: &AppState, user: &User) -> ApiResult<Value> {
    let now = Utc::now();
    let mut conn = state.db.acquire().await?;
    let counts = capsules::owned_counts(&mut conn, &user.id, &now).await?;
    let given = capsules::count_favorites_by_user(&mut conn, &user.id).await?;
    Ok(json!({
        "created": counts.states.all, "opened": counts.states.opened, "unopened": counts.states.unopened,
        "inPlaza": counts.in_plaza, "favoritesReceived": counts.favorites_received, "favoritesGiven": given,
    }))
}

pub async fn my_capsules(
    state: &AppState,
    user: &User,
    page: i64,
    page_size: i64,
) -> ApiResult<Value> {
    validation::page(page, page_size)?;
    let now = Utc::now();
    let mut conn = state.db.acquire().await?;
    let total = capsules::count_by_owner(&mut conn, &user.id).await?;
    let rows =
        capsules::find_by_owner_page(&mut conn, &user.id, page_size, (page - 1) * page_size)
            .await?;
    Ok(mapper::paginated(
        rows.iter().map(|v| mapper::list_item(v, &now)).collect(),
        total,
        page,
        page_size,
    ))
}

pub async fn my_favorites(
    state: &AppState,
    user: &User,
    page: i64,
    page_size: i64,
) -> ApiResult<Value> {
    validation::page(page, page_size)?;
    let now = Utc::now();
    let mut conn = state.db.acquire().await?;
    let total = capsules::count_favorites_by_user(&mut conn, &user.id).await?;
    let rows =
        capsules::find_favorites_page(&mut conn, &user.id, page_size, (page - 1) * page_size)
            .await?;
    Ok(mapper::paginated(
        rows.iter().map(|v| mapper::list_item(v, &now)).collect(),
        total,
        page,
        page_size,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{DateTime, Duration};

    use crate::config::AppConfig;
    use crate::domain::Capsule;
    use crate::infra::repos::users;
    use crate::services::{capsule, favorite};

    async fn state() -> AppState {
        let config = AppConfig {
            db_driver: "sqlite".into(),
            db_url: Some("sqlite:///:memory:".into()),
            repo_root: concat!(env!("CARGO_MANIFEST_DIR"), "/../..").into(),
            ..AppConfig::from_environment()
        };
        let state = AppState::build(config).unwrap();
        let mut conn = state.db.acquire().await.unwrap();
        for stmt in include_str!("../../../../spec/db/schema.sqlite.sql").split(';').map(str::trim) {
            if !stmt.is_empty() {
                conn.execute(stmt, &[]).await.unwrap();
            }
        }
        conn.execute("PRAGMA foreign_keys = OFF", &[]).await.unwrap();
        state
    }

    async fn add_user(state: &AppState, nickname: &str) -> User {
        let now = Utc::now();
        let user = User {
            id: Uuid::new_v4(),
            email: format!("{}@example.test", nickname.to_lowercase()),
            password_hash: "test".into(), nickname: nickname.into(), avatar_id: "neo".into(),
            created_at: now, updated_at: now,
        };
        users::insert(&mut state.db.acquire().await.unwrap(), &user).await.unwrap();
        user
    }

    async fn add_capsule(
        state: &AppState, owner: &User, title: &str, open_at: DateTime<Utc>, in_plaza: bool,
    ) -> Uuid {
        let created_at = open_at - Duration::hours(1);
        let entry = Capsule {
            id: Uuid::new_v4(), owner_id: owner.id, code: capsule::generate_code(), title: title.into(),
            content: "test".into(), open_at, in_plaza, favorite_count: 0, created_at, updated_at: created_at,
        };
        capsules::insert(&mut state.db.acquire().await.unwrap(), &entry).await.unwrap();
        entry.id
    }

    #[tokio::test]
    async fn stats_and_list_share_literal_search() {
        let state = state().await;
        assert_eq!(plaza_stats(&state, None).await.unwrap(), json!({
            "counts": {"all": 0, "opened": 0, "unopened": 0}, "farthestOpenAt": null, "nextOpenAt": null,
        }));
        let owner = add_user(&state, "Writer_One").await;
        let other = add_user(&state, "WriterXOne").await;
        let now = Utc::now();
        let next = now + Duration::hours(1);
        let farthest = now + Duration::hours(2);
        add_capsule(&state, &owner, r"Report%_\", now - Duration::hours(1), true).await;
        add_capsule(&state, &other, "Unrelated", next, true).await;
        add_capsule(&state, &other, "ReportXYZ", farthest, true).await;
        add_capsule(&state, &owner, r"Report%_\", now + Duration::hours(3), false).await;
        for search in [r" REPORT%_\ ", r"\", "%", "_", "WRITER_ONE"] {
            let stats = plaza_stats(&state, Some(search)).await.unwrap();
            assert_eq!(stats, json!({
                "counts": {"all": 1, "opened": 1, "unopened": 0},
                "farthestOpenAt": iso_date::json_string(&farthest), "nextOpenAt": iso_date::json_string(&next),
            }));
            for (filter, expected) in [("all", 1), ("opened", 1), ("unopened", 0)] {
                let page = plaza_list(&state, "new", filter, Some(search), 1, 20, None).await.unwrap();
                assert_eq!(page["pagination"]["total"], expected);
                assert_eq!(page["items"].as_array().unwrap().len(), expected);
            }
        }
    }

    #[tokio::test]
    async fn private_self_favorites_and_explicit_delete() {
        let state = state().await;
        let owner = add_user(&state, "Owner").await;
        let viewer = add_user(&state, "Viewer").await;
        let id = add_capsule(&state, &owner, "Private", Utc::now() + Duration::hours(1), false).await.to_string();

        assert_eq!(capsule::get_plaza_detail(&state, "invalid", None).await.unwrap_err().code, "VALIDATION_ERROR");
        assert_eq!(capsule::delete_own(&state, &owner, "invalid").await.unwrap_err().code, "VALIDATION_ERROR");
        assert_eq!(favorite::remove_favorite(&state, &owner, "invalid").await.unwrap_err().code, "VALIDATION_ERROR");
        assert_eq!(favorite::add_favorite(&state, &owner, Some("invalid")).await.unwrap_err().code, "VALIDATION_ERROR");
        let first = favorite::add_favorite(&state, &owner, Some(&id)).await.unwrap();
        assert_eq!(first["favoriteCount"], 1);
        assert_eq!(first, favorite::add_favorite(&state, &owner, Some(&id)).await.unwrap());
        favorite::add_favorite(&state, &viewer, Some(&id)).await.unwrap();
        let own = my_capsules(&state, &owner, 1, 20).await.unwrap();
        assert_eq!(own["items"][0]["favoritedByMe"], true);
        assert!(own["items"][0]["favoritedAt"].is_null());
        assert_eq!(my_favorites(&state, &viewer, 1, 20).await.unwrap()["items"][0]["inPlaza"], false);
        assert_eq!(my_stats(&state, &owner).await.unwrap(), json!({
            "created": 1, "opened": 0, "unopened": 1, "inPlaza": 0, "favoritesReceived": 2, "favoritesGiven": 1,
        }));
        capsule::delete_own(&state, &owner, &id).await.unwrap();
        for user in [&owner, &viewer] {
            assert_eq!(my_stats(&state, user).await.unwrap(), json!({
                "created": 0, "opened": 0, "unopened": 0, "inPlaza": 0, "favoritesReceived": 0, "favoritesGiven": 0,
            }));
        }
    }
}
