// Package model 定义 GORM 数据模型（与 spec/db/schema.sql 对齐）。
package model

import (
	"time"
)

// User 对应 users 表。
type User struct {
	ID           string    `gorm:"primaryKey;type:varchar(36);not null"`
	Email        string    `gorm:"uniqueIndex;type:varchar(254);not null"`
	PasswordHash string    `gorm:"type:varchar(100);not null"`
	Nickname     string    `gorm:"uniqueIndex;type:varchar(20);not null"`
	AvatarID     string    `gorm:"type:varchar(20);not null"`
	CreatedAt    time.Time `gorm:"not null;autoCreateTime"`
	UpdatedAt    time.Time `gorm:"not null;autoUpdateTime"`
}

// Capsule 对应 capsules 表。
type Capsule struct {
	ID            string    `gorm:"primaryKey;type:varchar(36);not null"`
	OwnerID       string    `gorm:"type:varchar(36);not null;index"`
	Code          string    `gorm:"uniqueIndex;type:varchar(8);not null"`
	Title         string    `gorm:"type:varchar(60);not null"`
	Content       string    `gorm:"type:text;not null"`
	OpenAt        time.Time `gorm:"not null;index"`
	InPlaza       bool      `gorm:"not null"`
	FavoriteCount int       `gorm:"not null;default:0"`
	CreatedAt     time.Time `gorm:"not null;autoCreateTime;index"`
	UpdatedAt     time.Time `gorm:"not null;autoUpdateTime"`
}

// Favorite 对应 favorites 表，复合主键 (user_id, capsule_id)。
type Favorite struct {
	UserID    string    `gorm:"primaryKey;type:varchar(36);not null"`
	CapsuleID string    `gorm:"primaryKey;type:varchar(36);not null;index"`
	CreatedAt time.Time `gorm:"not null;autoCreateTime;index"`
}

// RefreshToken 对应 refresh_tokens 表。
type RefreshToken struct {
	ID        string     `gorm:"primaryKey;type:varchar(36);not null"`
	UserID    string     `gorm:"type:varchar(36);not null;index"`
	TokenHash string     `gorm:"uniqueIndex;type:varchar(100);not null"`
	FamilyID  string     `gorm:"type:varchar(36);not null;index"`
	ExpiresAt time.Time  `gorm:"not null"`
	CreatedAt time.Time  `gorm:"not null;autoCreateTime"`
	RevokedAt *time.Time `gorm:"index"`
}
