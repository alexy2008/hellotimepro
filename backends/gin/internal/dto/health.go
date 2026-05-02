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
	Kind  string      `json:"kind"` // "backend"
	Items []StackItem `json:"items"`
}

// HealthData 健康检查响应体。
type HealthData struct {
	Status        string    `json:"status"`
	Service       string    `json:"service"`
	Version       string    `json:"version"`
	UptimeSeconds int       `json:"uptimeSeconds"`
	Stack         StackInfo `json:"stack"`
}

// StackNarrationFrontend 前端技术栈信息。
type StackNarrationFrontend struct {
	Name  string      `json:"name"`
	Items []StackItem `json:"items"`
}

// StackNarrationBackend 后端技术栈信息。
type StackNarrationBackend struct {
	Kind    string      `json:"kind"`
	Service string      `json:"service"`
	Version string      `json:"version"`
	Items   []StackItem `json:"items"`
}

// StackNarrationRequest AI 叙述请求体。
type StackNarrationRequest struct {
	Frontend StackNarrationFrontend `json:"frontend"`
	Backend  StackNarrationBackend  `json:"backend"`
	Locale   string                 `json:"locale"`
}

// StackNarration AI 叙述响应体（与 FastAPI spec 对齐）。
type StackNarration struct {
	Title       string `json:"title"`
	Narrative   string `json:"narrative"`
	GeneratedBy string `json:"generatedBy"`
	Cached      bool   `json:"cached"`
}
