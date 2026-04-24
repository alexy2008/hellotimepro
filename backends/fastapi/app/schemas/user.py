"""用户相关 DTO。"""

from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

_NICKNAME_RE = re.compile(r"^[\w\-\u4e00-\u9fff]{2,20}$", re.UNICODE)
_PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")
_AVATAR_RE = re.compile(r"^[a-z0-9-]{2,20}$")


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    nickname: str
    avatarId: str
    createdAt: datetime


class UserBrief(BaseModel):
    nickname: str
    avatarId: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nickname: str = Field(min_length=2, max_length=20)
    avatarId: str = Field(min_length=2, max_length=20)

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        if not _PASSWORD_RE.match(v):
            raise ValueError("密码至少 8 位且需包含字母和数字")
        return v

    @field_validator("nickname")
    @classmethod
    def _nickname_policy(cls, v: str) -> str:
        if not _NICKNAME_RE.match(v):
            raise ValueError("昵称仅允许中英文、数字、下划线、连字符")
        return v

    @field_validator("avatarId")
    @classmethod
    def _avatar_policy(cls, v: str) -> str:
        if not _AVATAR_RE.match(v):
            raise ValueError("头像 ID 格式不合法")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class LogoutRequest(BaseModel):
    refreshToken: str | None = None


class AuthTokens(BaseModel):
    accessToken: str
    refreshToken: str
    accessTokenExpiresIn: int
    refreshTokenExpiresIn: int
    user: UserOut


class UpdateProfileRequest(BaseModel):
    nickname: str | None = Field(default=None, min_length=2, max_length=20)
    avatarId: str | None = Field(default=None, min_length=2, max_length=20)

    @model_validator(mode="after")
    def _at_least_one(self) -> "UpdateProfileRequest":
        if self.nickname is None and self.avatarId is None:
            raise ValueError("nickname / avatarId 至少提供一个")
        return self

    @field_validator("nickname")
    @classmethod
    def _nickname_policy(cls, v: str | None) -> str | None:
        if v is not None and not _NICKNAME_RE.match(v):
            raise ValueError("昵称仅允许中英文、数字、下划线、连字符")
        return v

    @field_validator("avatarId")
    @classmethod
    def _avatar_policy(cls, v: str | None) -> str | None:
        if v is not None and not _AVATAR_RE.match(v):
            raise ValueError("头像 ID 格式不合法")
        return v


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def _new_policy(cls, v: str) -> str:
        if not _PASSWORD_RE.match(v):
            raise ValueError("新密码至少 8 位且需包含字母和数字")
        return v
