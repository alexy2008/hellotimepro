// Package middleware 提供 Gin 中间件。
package middleware

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"hellotime/gin/internal/core"
	"hellotime/gin/internal/model"
)

const (
	CtxUser     = "currentUser"
	CtxViewerID = "viewerID"
)

func parseBearer(c *gin.Context) string {
	auth := c.GetHeader("Authorization")
	if auth == "" {
		return ""
	}
	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func resolveUser(c *gin.Context, db *gorm.DB) *model.User {
	token := parseBearer(c)
	if token == "" {
		return nil
	}
	claims, err := core.DecodeAccessToken(token)
	if err != nil {
		return nil
	}
	var user model.User
	if err := db.First(&user, "id = ?", claims.Subject).Error; err != nil {
		return nil
	}
	return &user
}

// OptionalAuth 解析 Bearer token，将 *model.User 写入 context（可为 nil）。
func OptionalAuth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := resolveUser(c, db)
		c.Set(CtxUser, user)
		if user != nil {
			c.Set(CtxViewerID, user.ID)
		} else {
			c.Set(CtxViewerID, "")
		}
		c.Next()
	}
}

// RequireAuth 要求有效 Bearer token，否则返回 401。
func RequireAuth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := parseBearer(c)
		if token == "" {
			RespondErr(c, core.UnauthorizedErr("缺少 access token"))
			c.Abort()
			return
		}
		claims, err := core.DecodeAccessToken(token)
		if err != nil {
			var tpe *core.TokenParseError
			if errors.As(err, &tpe) {
				RespondErr(c, core.UnauthorizedErr(tpe.Reason))
			} else {
				RespondErr(c, core.UnauthorizedErr("invalid_token"))
			}
			c.Abort()
			return
		}
		var user model.User
		if err := db.First(&user, "id = ?", claims.Subject).Error; err != nil {
			RespondErr(c, core.UnauthorizedErr("用户不存在"))
			c.Abort()
			return
		}
		c.Set(CtxUser, &user)
		c.Set(CtxViewerID, user.ID)
		c.Next()
	}
}

// CurrentUser 从 context 获取已登录用户（RequireAuth 保证非 nil）。
func CurrentUser(c *gin.Context) *model.User {
	u, _ := c.Get(CtxUser)
	if u == nil {
		return nil
	}
	return u.(*model.User)
}

// ViewerID 从 context 获取可选的 viewer UUID 字符串。
func ViewerID(c *gin.Context) string {
	v, _ := c.Get(CtxViewerID)
	if v == nil {
		return ""
	}
	s, _ := v.(string)
	return s
}

// RespondErr 统一写错误响应，接受 error 接口。
func RespondErr(c *gin.Context, err error) {
	var apiErr *core.APIError
	if !errors.As(err, &apiErr) {
		apiErr = core.InternalErr(err.Error())
	}
	body := gin.H{
		"success":   false,
		"data":      nil,
		"message":   apiErr.Message,
		"errorCode": string(apiErr.Code),
	}
	if len(apiErr.Details) > 0 {
		details := make([]gin.H, len(apiErr.Details))
		for i, d := range apiErr.Details {
			details[i] = gin.H{"field": d.Field, "message": d.Message}
		}
		body["details"] = details
	}
	c.JSON(apiErr.StatusCode, body)
}
