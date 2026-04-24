"""鉴权原语：bcrypt 密码哈希 + JWT access token + 不透明 refresh token。"""

from __future__ import annotations

import base64
import hashlib
import secrets
import time
import uuid

import bcrypt
import jwt

from app.core.config import settings


# ---------- 密码 ----------
def hash_password(plain: str) -> str:
    salt = bcrypt.gensalt(rounds=settings.bcrypt_rounds)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------- Access Token (JWT HS256) ----------
def create_access_token(*, user_id: uuid.UUID, nickname: str, avatar_id: str) -> tuple[str, int]:
    """返回 (token, 过期秒数)。"""
    now = int(time.time())
    exp = now + settings.access_token_ttl_seconds
    payload = {
        "sub": str(user_id),
        "nickname": nickname,
        "avatarId": avatar_id,
        "iat": now,
        "exp": exp,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.access_token_ttl_seconds


class AccessTokenError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as e:
        raise AccessTokenError("access_token_expired") from e
    except jwt.InvalidTokenError as e:
        raise AccessTokenError("invalid_token") from e


# ---------- Refresh Token ----------
# 不透明：256-bit 随机 + base64url；DB 存 sha256 hash，比对时 hash 输入。
# 请求侧的无效 token 也参与 hash 后自然查无匹配，不能因为编码问题变成 500。
def generate_refresh_token() -> str:
    raw = secrets.token_bytes(32)
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
