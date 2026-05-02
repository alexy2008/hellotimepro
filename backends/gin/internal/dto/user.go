package dto

import "time"

// UserOut 用户公开信息（登录后）。
type UserOut struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Nickname  string    `json:"nickname"`
	AvatarID  string    `json:"avatarId"`
	CreatedAt time.Time `json:"createdAt"`
}

// UserBrief 胶囊展示用的精简用户信息。
type UserBrief struct {
	Nickname string `json:"nickname"`
	AvatarID string `json:"avatarId"`
}

// AuthTokens 登录/注册/刷新后返回的令牌对。
type AuthTokens struct {
	AccessToken            string  `json:"accessToken"`
	RefreshToken           string  `json:"refreshToken"`
	AccessTokenExpiresIn   int     `json:"accessTokenExpiresIn"`
	RefreshTokenExpiresIn  int     `json:"refreshTokenExpiresIn"`
	User                   UserOut `json:"user"`
}

// RegisterRequest 注册请求体。
type RegisterRequest struct {
	Email    string `json:"email"    binding:"required,email,max=254"`
	Password string `json:"password" binding:"required,min=8,max=128"`
	Nickname string `json:"nickname" binding:"required,min=2,max=20"`
	AvatarID string `json:"avatarId" binding:"required,min=2,max=20"`
}

// LoginRequest 登录请求体。
type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// RefreshRequest 刷新令牌请求体。
type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

// LogoutRequest 登出请求体（可选）。
type LogoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// UpdateProfileRequest 修改资料请求体（至少提供一项）。
type UpdateProfileRequest struct {
	Nickname *string `json:"nickname" binding:"omitempty,min=2,max=20"`
	AvatarID *string `json:"avatarId" binding:"omitempty,min=2,max=20"`
}

// ChangePasswordRequest 修改密码请求体。
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword"     binding:"required,min=8,max=128"`
}
