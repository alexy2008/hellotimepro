use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

use crate::web::envelope;

/// 业务异常：实现 IntoResponse，handler 直接 `?` 抛出即可得到契约错误外壳。
/// 对应 Vapor 的 ApiError + ApiErrorMiddleware。
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
    pub details: Option<Vec<(String, String)>>,
}

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn validation(message: impl Into<String>, field: impl Into<String>) -> ApiError {
        let message = message.into();
        ApiError {
            status: StatusCode::UNPROCESSABLE_ENTITY,
            code: "VALIDATION_ERROR",
            details: Some(vec![(field.into(), message.clone())]),
            message,
        }
    }

    pub fn unauthorized(message: impl Into<String>) -> ApiError {
        ApiError {
            status: StatusCode::UNAUTHORIZED,
            code: "UNAUTHORIZED",
            message: message.into(),
            details: None,
        }
    }

    pub fn forbidden(message: impl Into<String>) -> ApiError {
        ApiError {
            status: StatusCode::FORBIDDEN,
            code: "FORBIDDEN",
            message: message.into(),
            details: None,
        }
    }

    pub fn not_found(message: impl Into<String>) -> ApiError {
        ApiError {
            status: StatusCode::NOT_FOUND,
            code: "NOT_FOUND",
            message: message.into(),
            details: None,
        }
    }

    pub fn conflict(message: impl Into<String>, field: impl Into<String>) -> ApiError {
        let message = message.into();
        ApiError {
            status: StatusCode::CONFLICT,
            code: "CONFLICT",
            details: Some(vec![(field.into(), message.clone())]),
            message,
        }
    }

    pub fn bad_request(message: impl Into<String>) -> ApiError {
        ApiError {
            status: StatusCode::BAD_REQUEST,
            code: "BAD_REQUEST",
            message: message.into(),
            details: None,
        }
    }

    pub fn rate_limited(message: impl Into<String>) -> ApiError {
        ApiError {
            status: StatusCode::TOO_MANY_REQUESTS,
            code: "RATE_LIMITED",
            message: message.into(),
            details: None,
        }
    }

    pub fn internal(message: impl Into<String>) -> ApiError {
        let message = message.into();
        tracing::error!("internal error: {message}");
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            code: "INTERNAL_ERROR",
            message: "服务器内部错误".to_string(),
            details: None,
        }
    }

    /// 请求体反序列化失败（坏 JSON / 字段类型不符）→ 422 VALIDATION_ERROR。
    pub fn invalid_body() -> ApiError {
        ApiError {
            status: StatusCode::UNPROCESSABLE_ENTITY,
            code: "VALIDATION_ERROR",
            message: "字段校验失败".to_string(),
            details: Some(vec![("body".to_string(), "请求体格式不合法".to_string())]),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        envelope::error(self.status, self.code, &self.message, self.details.as_deref())
    }
}
