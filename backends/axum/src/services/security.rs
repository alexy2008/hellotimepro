use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use rand::RngCore;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::config::AppConfig;
use crate::domain::User;

type HmacSha256 = Hmac<Sha256>;

/// 密码哈希（bcrypt crate，cost 10，兼容 seed 的 $2b$）与 JWT（HS256，手写编解码）
/// + refresh token 生成/哈希。对应 Vapor 的 SecurityService。

// ── 密码 ───────────────────────────────────────────────────────────────────

pub fn hash_password(plain: &str) -> Result<String, String> {
    bcrypt::hash(plain, 10).map_err(|e| format!("bcrypt 失败: {e}"))
}

pub fn verify_password(plain: &str, hashed: &str) -> bool {
    bcrypt::verify(plain, hashed).unwrap_or(false)
}

// ── JWT HS256 ───────────────────────────────────────────────────────────────
// 标准 JWT 形态：base64url(header).base64url(payload).base64url(HMAC-SHA256)。
// 不引第三方 JWT 库：HS256 签发/校验各 ~20 行，hmac + sha2 即够。

pub fn create_access_token(config: &AppConfig, user: &User, now: &DateTime<Utc>) -> String {
    let iat = now.timestamp();
    let payload = json!({
        "sub": user.id.to_string(),
        "nickname": user.nickname,
        "avatarId": user.avatar_id,
        "iat": iat,
        "exp": iat + config.access_token_ttl_seconds,
    });
    let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
    let body = URL_SAFE_NO_PAD.encode(payload.to_string().as_bytes());
    let signing_input = format!("{header}.{body}");
    let mut mac = HmacSha256::new_from_slice(config.jwt_secret.as_bytes()).unwrap();
    mac.update(signing_input.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    format!("{signing_input}.{signature}")
}

pub struct DecodeResult {
    pub subject: Option<String>,
    pub error: Option<&'static str>,
}

/// 校验 access token。过期统一 error="access_token_expired"；其它非法 error="invalid_token"。
pub fn decode_access_token(config: &AppConfig, token: &str, now: &DateTime<Utc>) -> DecodeResult {
    let invalid = || DecodeResult { subject: None, error: Some("invalid_token") };
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return invalid();
    }
    let Ok(signature) = URL_SAFE_NO_PAD.decode(parts[2]) else {
        return invalid();
    };
    let signing_input = format!("{}.{}", parts[0], parts[1]);
    let mut mac = HmacSha256::new_from_slice(config.jwt_secret.as_bytes()).unwrap();
    mac.update(signing_input.as_bytes());
    if mac.verify_slice(&signature).is_err() {
        return invalid();
    }
    let Ok(payload_bytes) = URL_SAFE_NO_PAD.decode(parts[1]) else {
        return invalid();
    };
    let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&payload_bytes) else {
        return invalid();
    };
    let Some(sub) = payload.get("sub").and_then(|v| v.as_str()) else {
        return invalid();
    };
    let Some(exp) = payload.get("exp").and_then(|v| v.as_i64()) else {
        return invalid();
    };
    if exp <= now.timestamp() {
        return DecodeResult { subject: None, error: Some("access_token_expired") };
    }
    DecodeResult { subject: Some(sub.to_string()), error: None }
}

// ── Refresh token ───────────────────────────────────────────────────────────

/// 不透明随机 256-bit base64url 字符串。
pub fn generate_refresh_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// 落库只存 SHA-256 hex，原文不落库。
pub fn hash_refresh_token(raw: &str) -> String {
    let digest = Sha256::digest(raw.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn test_config() -> AppConfig {
        let mut c = AppConfig::from_environment();
        c.jwt_secret = "unit-test-secret".to_string();
        c.access_token_ttl_seconds = 3600;
        c
    }

    fn test_user() -> User {
        let now = Utc::now();
        User {
            id: Uuid::new_v4(),
            email: "t@e.st".into(),
            password_hash: String::new(),
            nickname: "tester".into(),
            avatar_id: "cat".into(),
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn jwt_round_trip() {
        let config = test_config();
        let user = test_user();
        let now = Utc::now();
        let token = create_access_token(&config, &user, &now);
        let decoded = decode_access_token(&config, &token, &now);
        assert_eq!(decoded.subject.as_deref(), Some(user.id.to_string().as_str()));
        assert!(decoded.error.is_none());
    }

    #[test]
    fn jwt_expired() {
        let config = test_config();
        let user = test_user();
        let past = Utc::now() - chrono::Duration::seconds(7200);
        let token = create_access_token(&config, &user, &past);
        let decoded = decode_access_token(&config, &token, &Utc::now());
        assert_eq!(decoded.error, Some("access_token_expired"));
        assert!(decoded.subject.is_none());
    }

    #[test]
    fn jwt_tampered() {
        let config = test_config();
        let user = test_user();
        let now = Utc::now();
        let mut token = create_access_token(&config, &user, &now);
        token.push('x');
        let decoded = decode_access_token(&config, &token, &now);
        assert_eq!(decoded.error, Some("invalid_token"));
        assert!(decode_access_token(&config, "garbage", &now).subject.is_none());
    }

    #[test]
    fn refresh_token_shape() {
        let t1 = generate_refresh_token();
        let t2 = generate_refresh_token();
        assert_ne!(t1, t2);
        assert!(t1.len() >= 42); // 32 字节 base64url ≈ 43 字符
        let h = hash_refresh_token(&t1);
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(h, hash_refresh_token(&t1)); // 确定性
    }
}
