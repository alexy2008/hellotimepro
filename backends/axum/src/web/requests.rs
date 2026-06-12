use serde::Deserialize;

/// 请求体 DTO：字段全部可选，缺失/为 null 都先收下来，由 Validation 统一裁决
/// （这样"缺字段"也能返回契约要求的 422 + details，而不是解码层 4xx）。

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: Option<String>,
    pub password: Option<String>,
    pub nickname: Option<String>,
    pub avatar_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: Option<String>,
    pub password: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRequest {
    pub refresh_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoutRequest {
    pub refresh_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileRequest {
    pub nickname: Option<String>,
    pub avatar_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordRequest {
    pub current_password: Option<String>,
    pub new_password: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCapsuleRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub open_at: Option<String>,
    pub in_plaza: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteRequest {
    pub capsule_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapsuleSuggestionRequest {
    pub title: Option<String>,
    #[allow(dead_code)]
    pub locale: Option<String>,
}
