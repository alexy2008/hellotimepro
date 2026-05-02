// Package handler 包含所有 Gin 路由处理函数。
package handler

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/dto"
	"hellotime/gin/internal/service"
)

var startedAt = time.Now()

type techMetaEntry struct {
	Tagline  string   `json:"tagline"`
	Features []string `json:"features"`
}

var techMeta map[string]techMetaEntry

func init() {
	metaPath := filepath.Join(filepath.Dir(config.App.IconsSourceDir), "tech-meta.json")
	if data, err := os.ReadFile(metaPath); err == nil {
		_ = json.Unmarshal(data, &techMeta)
	}
}

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
		{Role: "language", Name: "Go", Version: goVer, IconURL: ptrStr(iconBase + "go.svg")},
		{Role: "framework", Name: "Gin", Version: ginVer, IconURL: ptrStr(iconBase + "gin.svg")},
		{
			Role:    "database",
			Name:    dbName,
			Version: dbVer,
			IconURL: ptrStr(iconBase + strings.ToLower(dbName) + ".svg"),
		},
	}

	if techMeta != nil {
		for i, item := range items {
			if meta, ok := techMeta[item.Name]; ok {
				if meta.Tagline != "" {
					items[i].Tagline = ptrStr(meta.Tagline)
				}
				if len(meta.Features) > 0 {
					items[i].Features = meta.Features
				}
			}
		}
	}

	return dto.StackInfo{Kind: "backend", Items: items}
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

// PostStackNarration POST /api/v1/stack-narration
func PostStackNarration(c *gin.Context) {
	var req dto.StackNarrationRequest
	_ = c.ShouldBindJSON(&req)
	c.JSON(http.StatusOK, dto.OK(service.NarrateStack(req)))
}
