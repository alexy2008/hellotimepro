package dto

import "time"

// CapsuleSuggestionRequest AI 胶囊生成请求体。
// Title 可选：留空表示由 AI 同时生成标题（空标题模式）。
type CapsuleSuggestionRequest struct {
	Title  string `json:"title" binding:"max=60"`
	Locale string `json:"locale"`
}

// CapsuleSuggestion AI 胶囊生成响应体。
// Title 仅在空标题模式下返回（由 AI 或本地兜底生成），供前端回填。
type CapsuleSuggestion struct {
	Title       string    `json:"title,omitempty"`
	Content     string    `json:"content"`
	OpenInDays  int       `json:"openInDays"`
	OpenAt      time.Time `json:"openAt"`
	GeneratedBy string    `json:"generatedBy"`
	Cached      bool      `json:"cached"`
}
