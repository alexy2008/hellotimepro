// Package core 提供错误码定义与统一的 APIError 类型。
package core

import "fmt"

// ErrorCode 与 spec/api/openapi.yaml 中定义的 errorCode 对应。
type ErrorCode string

const (
	ErrValidation   ErrorCode = "VALIDATION_ERROR"
	ErrUnauthorized ErrorCode = "UNAUTHORIZED"
	ErrForbidden    ErrorCode = "FORBIDDEN"
	ErrNotFound     ErrorCode = "NOT_FOUND"
	ErrConflict     ErrorCode = "CONFLICT"
	ErrRateLimited  ErrorCode = "RATE_LIMITED"
	ErrBadRequest   ErrorCode = "BAD_REQUEST"
	ErrInternal     ErrorCode = "INTERNAL_ERROR"
)

var codeToStatus = map[ErrorCode]int{
	ErrValidation:   422,
	ErrUnauthorized: 401,
	ErrForbidden:    403,
	ErrNotFound:     404,
	ErrConflict:     409,
	ErrRateLimited:  429,
	ErrBadRequest:   400,
	ErrInternal:     500,
}

// ErrDetail 是校验错误的字段级详情。
type ErrDetail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// APIError 是所有业务异常的统一类型，handler 层捕获后序列化为 ErrorEnvelope。
type APIError struct {
	Code       ErrorCode
	Message    string
	StatusCode int
	Details    []ErrDetail
}

func (e *APIError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func newErr(code ErrorCode, msg string, details ...ErrDetail) *APIError {
	return &APIError{
		Code:       code,
		Message:    msg,
		StatusCode: codeToStatus[code],
		Details:    details,
	}
}

func ValidationErr(msg, field string) *APIError {
	return newErr(ErrValidation, msg, ErrDetail{Field: field, Message: msg})
}

func UnauthorizedErr(msg string) *APIError {
	return newErr(ErrUnauthorized, msg)
}

func ForbiddenErr(msg string) *APIError {
	return newErr(ErrForbidden, msg)
}

func NotFoundErr(msg string) *APIError {
	return newErr(ErrNotFound, msg)
}

func ConflictErr(msg string, field ...string) *APIError {
	if len(field) > 0 && field[0] != "" {
		return newErr(ErrConflict, msg, ErrDetail{Field: field[0], Message: msg})
	}
	return newErr(ErrConflict, msg)
}

func BadRequestErr(msg string) *APIError {
	return newErr(ErrBadRequest, msg)
}

func RateLimitedErr() *APIError {
	return newErr(ErrRateLimited, "操作过于频繁，请稍后再试")
}

func InternalErr(msg string) *APIError {
	return newErr(ErrInternal, msg)
}

// NewAPIError 通用构造器（不带 details）。
func NewAPIError(code ErrorCode, msg string) *APIError {
	return newErr(code, msg)
}

// TokenParseError 是 JWT 解析错误。
type TokenParseError struct{ Reason string }

func (e *TokenParseError) Error() string { return e.Reason }
