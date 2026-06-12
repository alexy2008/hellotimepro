use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Value};

/// 统一响应外壳 `{ success, data, message, errorCode }`。
/// serde_json::Value 的 Null 序列化为显式 null，天然满足契约 strict equal 断言。

pub fn ok(data: Value) -> Response {
    ok_with(StatusCode::OK, data)
}

pub fn ok_with(status: StatusCode, data: Value) -> Response {
    let body = json!({
        "success": true,
        "data": data,
        "message": null,
        "errorCode": null,
    });
    (status, Json(body)).into_response()
}

pub fn error(
    status: StatusCode,
    code: &str,
    message: &str,
    details: Option<&[(String, String)]>,
) -> Response {
    let mut body = json!({
        "success": false,
        "data": null,
        "message": message,
        "errorCode": code,
    });
    if let Some(details) = details {
        if !details.is_empty() {
            body["details"] = Value::Array(
                details
                    .iter()
                    .map(|(field, message)| json!({"field": field, "message": message}))
                    .collect(),
            );
        }
    }
    (status, Json(body)).into_response()
}

pub fn no_content() -> Response {
    StatusCode::NO_CONTENT.into_response()
}
