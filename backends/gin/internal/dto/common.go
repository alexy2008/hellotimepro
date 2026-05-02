// Package dto 定义请求/响应 DTO，对应 spec/api/openapi.yaml 中的 schema。
package dto

// Envelope 是所有成功响应的统一包装。
type Envelope[T any] struct {
	Success   bool    `json:"success"`
	Data      T       `json:"data"`
	Message   *string `json:"message"`
	ErrorCode *string `json:"errorCode"`
}

// ErrEnvelope 是错误响应的统一包装。
type ErrEnvelope struct {
	Success   bool        `json:"success"`
	Data      any         `json:"data"`
	Message   string      `json:"message"`
	ErrorCode string      `json:"errorCode"`
	Details   []ErrDetail `json:"details,omitempty"`
}

// ErrDetail 是字段级校验错误。
type ErrDetail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Pagination 分页元数据。
type Pagination struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// Paginated 泛型分页结果。
type Paginated[T any] struct {
	Items      []T        `json:"items"`
	Pagination Pagination `json:"pagination"`
}

func OK[T any](data T) Envelope[T] {
	return Envelope[T]{Success: true, Data: data}
}

func CalcTotalPages(total, pageSize int) int {
	if pageSize <= 0 {
		return 0
	}
	pages := total / pageSize
	if total%pageSize != 0 {
		pages++
	}
	return pages
}
