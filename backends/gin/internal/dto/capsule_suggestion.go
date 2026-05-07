package dto

import "time"

// CapsuleSuggestionRequest AI 胶囊生成请求体。
type CapsuleSuggestionRequest struct {
	Title  string `json:"title" binding:"required,min=1,max=60"`
	Locale string `json:"locale"`
}

// CapsuleSuggestion AI 胶囊生成响应体。
type CapsuleSuggestion struct {
	Content     string    `json:"content"`
	OpenInDays  int       `json:"openInDays"`
	OpenAt      time.Time `json:"openAt"`
	GeneratedBy string    `json:"generatedBy"`
	Cached      bool      `json:"cached"`
}
