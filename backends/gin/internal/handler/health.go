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

	var dbTagline string
	var dbFeatures []string
	if config.App.DBDriver == "sqlite" {
		dbTagline = "零配置嵌入式关系型数据库，适合本地开发与测试"
		dbFeatures = []string{
			"DB_DRIVER=sqlite 一键切换，无需部署独立数据库服务",
			"GORM 抽象层使同一领域代码在 SQLite / PostgreSQL 间无缝切换",
			"WAL 模式支持并发读写，满足本地开发与 CI 验证场景",
		}
	} else {
		dbTagline = "功能丰富的开源关系型数据库，号称「最先进的开源数据库」"
		dbFeatures = []string{
			"ACID 事务保障 favorite_count 反规范化计数的写入一致性",
			"refresh_tokens 表以 family_id + revoked 实现令牌族追踪，防重放攻击",
			"DB_DRIVER 环境变量热切换 SQLite/PostgreSQL，无需修改业务代码",
		}
	}

	items := []dto.StackItem{
		{
			Role:    "language",
			Name:    "Go",
			Version: goVer,
			IconURL: ptrStr(iconBase + "go.svg"),
			Tagline: ptrStr("Google 设计的编译型静态语言，简洁与并发是其核心"),
			Features: []string{
				"静态类型 + 编译期检查，零值语义消灭大量运行时 nil 错误",
				"goroutine 原生并发，请求处理天然并行，单二进制部署",
				"标准库 net/http 为底座，框架层薄而透明，行为完全可预期",
			},
		},
		{
			Role:    "framework",
			Name:    "Gin",
			Version: ginVer,
			IconURL: ptrStr(iconBase + "gin.svg"),
			Tagline: ptrStr("Go 生态最流行的高性能 HTTP Web 框架"),
			Features: []string{
				"中间件链可组合：JWT 鉴权、CORS、Panic Recovery 独立挂载",
				"路由分组隔离权限：/auth 公开，/me 强制鉴权，/capsules 可选鉴权",
				"ShouldBindJSON 统一参数解析，错误经 Envelope 结构统一包装返回",
			},
		},
		{
			Role:     "database",
			Name:     dbName,
			Version:  dbVer,
			IconURL:  ptrStr(iconBase + strings.ToLower(dbName) + ".svg"),
			Tagline:  ptrStr(dbTagline),
			Features: dbFeatures,
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
