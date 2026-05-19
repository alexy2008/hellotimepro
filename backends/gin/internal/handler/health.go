// Package handler 包含所有 Gin 路由处理函数。
package handler

import (
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/service"
)

var startedAt = time.Now()

func ptrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func buildStack() dto.StackInfo {
	goVer := runtime.Version()
	ginVer := "1.10"
	dbName := "PostgreSQL"
	dbVer := "16"
	if config.App.DBDriver == "sqlite" {
		dbName = "SQLite"
		dbVer = "3"
	}

	iconBase := "/static/icons/"

	items := []dto.StackItem{
		{
			Role:    "language",
			Name:    "Go",
			Version: goVer,
			IconURL: ptrStr(iconBase + "go.svg"),
		},
		{
			Role:    "framework",
			Name:    "Gin",
			Version: ginVer,
			IconURL: ptrStr(iconBase + "gin.svg"),
		},
		{
			Role:    "database",
			Name:    dbName,
			Version: dbVer,
			IconURL: ptrStr(iconBase + strings.ToLower(dbName) + ".svg"),
		},
	}

	summary := "基于 Go + Gin 构建，中间件链可组合，路由分组按权限隔离，" +
		"ShouldBindJSON 统一参数解析，GORM 双驱动热切换 " + dbName + " / SQLite，" +
		"刷新令牌族追踪（family_id + revoked）防重放攻击。"
	if config.App.DBDriver == "sqlite" {
		summary = "基于 Go + Gin 构建，中间件链可组合，路由分组按权限隔离，" +
			"ShouldBindJSON 统一参数解析，GORM 抽象层屏蔽 SQLite / PostgreSQL 差异，" +
			"适合本地开发与 CI 验证场景。"
	}

	return dto.StackInfo{Kind: "backend", Summary: summary, Items: items}
}

// GetHealth GET /api/v1/health
func GetHealth(c *gin.Context) {
	data := dto.HealthData{
		Status:        "ok",
		Service:       config.App.ServiceName,
		Version:       config.App.ServiceVersion,
		UptimeSeconds: int(time.Since(startedAt).Seconds()),
		Stack:         buildStack(),
	}
	c.JSON(http.StatusOK, dto.OK(data))
}

// GetAvatars GET /api/v1/avatars
func GetAvatars(c *gin.Context) {
	c.JSON(http.StatusOK, dto.OK(service.Avatars()))
}
