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

	summary := "基于 Go + Gin + GORM 核心骨架，使用仓库级 scripts/db 维护数据库 schema，" +
		"golang-jwt 结合 bcrypt 提供安全的 JWT 与密码处理，同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。" +
		"利用 Go 语言轻量级协程和原生高并发的优势，配合 Gin 的 HTTP 路由与中间件链，" +
		"实现极低的请求延迟与优异的吞吐量。" +
		"GORM 通过简洁的结构体标签实现强大的表关系映射与自动数据映射，大幅简化数据持久化代码。" +
		"在 SQLite 模式下对路径与锁行为进行了精细设计，" +
		"服务启动过程只负责连接已准备好的数据库，不承担建表或演示数据导入。" +
		"项目在内部划分了配置层、核心工具层、数据模型层、数据载体层以及业务逻辑层，" +
		"实现了严格的展示与业务分离。"

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
