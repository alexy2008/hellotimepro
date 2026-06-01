// Package service — capsule_recommendation.go 为创建页提供 AI 推荐的胶囊主题列表。
// 推荐为锦上添花：LLM 不可用时返回空列表，不做本地兜底、不报错。
package service

import (
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/dto"
)

const (
	recoMinItems = 3
	recoMaxItems = 8
)

func recommendationPromptTemplate() string {
	path := filepath.Join(config.App.RepoRoot, "spec", "llm", "capsule-recommendation.prompt.md")
	if data, err := os.ReadFile(path); err == nil {
		return string(data)
	}
	return `你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。` +
		`每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。` +
		`只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。`
}

func buildRecommendationPrompt(count int) string {
	return strings.ReplaceAll(recommendationPromptTemplate(), "{COUNT}", strconv.Itoa(count))
}

func cleanRecoText(text string, limit int) string {
	cleaned := strings.TrimSpace(text)
	cleaned = strings.ReplaceAll(cleaned, "\n", " ")
	cleaned = strings.ReplaceAll(cleaned, "\r", " ")
	cleaned = strings.Trim(cleaned, "#*` 　\"'《》【】")
	cleaned = strings.TrimSpace(cleaned)
	runes := []rune(cleaned)
	if len(runes) > limit {
		cleaned = string(runes[:limit])
	}
	return strings.TrimSpace(cleaned)
}

func parseRecommendationItems(raw any) []dto.CapsuleRecommendationItem {
	items := []dto.CapsuleRecommendationItem{}
	rawList, ok := raw.([]any)
	if !ok {
		return items
	}
	seen := map[string]bool{}
	for _, entry := range rawList {
		m, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		title := cleanRecoText(asString(m["title"]), 60)
		hint := cleanRecoText(asString(m["hint"]), 80)
		days, daysOK := coerceOpenInDays(m["openInDays"])
		if title == "" || hint == "" || !daysOK {
			continue
		}
		if seen[title] {
			continue
		}
		seen[title] = true
		items = append(items, dto.CapsuleRecommendationItem{Title: title, Hint: hint, OpenInDays: days})
	}
	return items
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// GetCapsuleRecommendations 生成推荐列表；LLM 不可用时返回空列表（Items 为非 nil 空切片）。
func GetCapsuleRecommendations(count int, locale string) dto.CapsuleRecommendationList {
	if count < recoMinItems {
		count = recoMinItems
	}
	if count > recoMaxItems {
		count = recoMaxItems
	}

	items := []dto.CapsuleRecommendationItem{}
	result, err := GenerateCapsuleRecommendations(buildRecommendationPrompt(count))
	if err != nil {
		log.Printf("[capsule-recommendation] unavailable, returning empty list: %v", err)
	} else {
		items = parseRecommendationItems(result["items"])
		if len(items) > count {
			items = items[:count]
		}
	}

	generatedBy := "none"
	if len(items) > 0 {
		generatedBy = config.App.LLMProvider + ":" + config.App.LLMModel
	}
	return dto.CapsuleRecommendationList{Items: items, GeneratedBy: generatedBy, Cached: false}
}
