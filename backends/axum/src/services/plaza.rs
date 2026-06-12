use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::User;
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
    // q：trim 后为空视为未传；超 50 → 422；大小写不敏感子串匹配。
    let search = q
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty());
    if let Some(s) = &search {
        if s.chars().count() > 50 {
            return Err(ApiError::validation("q 长度不得超过 50", "q"));
        }
    }
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
