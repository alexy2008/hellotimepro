package dto

// CapsuleRecommendationItem 单条 AI 推荐主题（仅元数据，不含完整胶囊）。
type CapsuleRecommendationItem struct {
	Title      string `json:"title"`
	Hint       string `json:"hint"`
	OpenInDays int    `json:"openInDays"`
}

// CapsuleRecommendationList 推荐列表响应体。
// 推荐为锦上添花：LLM 不可用时 Items 为空数组（非 null），GeneratedBy 为 "none"。
type CapsuleRecommendationList struct {
	Items       []CapsuleRecommendationItem `json:"items"`
	GeneratedBy string                      `json:"generatedBy"`
	Cached      bool                        `json:"cached"`
}
