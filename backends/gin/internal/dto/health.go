package dto

// StackItem 技术栈中单个组件的元数据。
type StackItem struct {
	Role     string   `json:"role"`
	Name     string   `json:"name"`
	Version  string   `json:"version"`
	IconURL  *string  `json:"iconUrl"`
	Tagline  *string  `json:"tagline,omitempty"`
	Features []string `json:"features,omitempty"`
}

// StackInfo 技术栈整体信息。
type StackInfo struct {
	Kind    string      `json:"kind"`    // "backend" | "fullstack"
	Summary string      `json:"summary"` // 后端自述段落，供前端关于页展示
	Items   []StackItem `json:"items"`
}

// HealthData 健康检查响应体。
type HealthData struct {
	Status        string    `json:"status"`
	Service       string    `json:"service"`
	Version       string    `json:"version"`
	UptimeSeconds int       `json:"uptimeSeconds"`
	Stack         StackInfo `json:"stack"`
}
