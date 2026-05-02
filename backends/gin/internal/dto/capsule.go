package dto

import "time"

// CapsuleBase 胶囊公共字段。
type CapsuleBase struct {
	ID            string    `json:"id"`
	Code          string    `json:"code"`
	Title         string    `json:"title"`
	Creator       UserBrief `json:"creator"`
	OpenAt        time.Time `json:"openAt"`
	CreatedAt     time.Time `json:"createdAt"`
	InPlaza       bool      `json:"inPlaza"`
	FavoriteCount int       `json:"favoriteCount"`
	IsOpened      bool      `json:"isOpened"`
}

// CapsuleDetail 单个胶囊详情（含内容）。
type CapsuleDetail struct {
	CapsuleBase
	Content       *string `json:"content"`
	FavoritedByMe bool    `json:"favoritedByMe"`
}

// CapsuleListItem 列表项（含收藏状态与内容预览）。
type CapsuleListItem struct {
	CapsuleBase
	FavoritedByMe  bool       `json:"favoritedByMe"`
	FavoritedAt    *time.Time `json:"favoritedAt,omitempty"`
	ContentPreview *string    `json:"contentPreview"`
}

// CreateCapsuleRequest 创建胶囊请求体。
type CreateCapsuleRequest struct {
	Title   string    `json:"title"   binding:"required,min=1,max=60"`
	Content string    `json:"content" binding:"required,min=1,max=5000"`
	OpenAt  time.Time `json:"openAt"  binding:"required"`
	InPlaza *bool     `json:"inPlaza"`
}

// FavoriteRequest 收藏请求体。
type FavoriteRequest struct {
	CapsuleID string `json:"capsuleId" binding:"required"`
}

// FavoriteResult 收藏操作结果。
type FavoriteResult struct {
	CapsuleID     string    `json:"capsuleId"`
	FavoriteCount int       `json:"favoriteCount"`
	FavoritedAt   time.Time `json:"favoritedAt"`
}

// Avatar 头像目录项。
type Avatar struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	PrimaryColor string `json:"primaryColor"`
	SvgURL       string `json:"svgUrl"`
}
