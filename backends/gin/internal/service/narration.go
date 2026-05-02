// Package service — narration.go 提供带内存缓存的技术栈叙述生成服务。
package service

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/dto"
)

const narrationPromptVersion = "stack-narration-v2"

var (
	narrationCache   = make(map[string]dto.StackNarration)
	narrationCacheMu sync.RWMutex
)

// ---------- 辅助：读取 spec/ 文件 ----------

func promptTemplate() string {
	path := filepath.Join(config.App.RepoRoot, "spec", "llm", "stack-narration.prompt.md")
	data, err := os.ReadFile(path)
	if err == nil {
		return string(data)
	}
	return `你是一个资深全栈工程教育作者。请基于 STACK_JSON 和 TECH_META_JSON 生成严格 JSON：{"title":"...","narrative":"..."}`
}

func techMetaAll() map[string]any {
	path := filepath.Join(config.App.RepoRoot, "spec", "tech-meta.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var meta map[string]any
	_ = json.Unmarshal(data, &meta)
	return meta
}

// selectedMeta 只保留请求中出现的技术名称的 meta 条目。
func selectedMeta(req dto.StackNarrationRequest) map[string]any {
	names := make(map[string]bool)
	for _, item := range req.Frontend.Items {
		names[item.Name] = true
	}
	for _, item := range req.Backend.Items {
		names[item.Name] = true
	}
	all := techMetaAll()
	selected := make(map[string]any)
	for name := range names {
		if entry, ok := all[name]; ok {
			selected[name] = entry
		}
	}
	return selected
}

// ---------- 缓存键 ----------

// narrationCacheKey 基于请求内容、模型名和 prompt 版本生成 SHA-256 缓存键。
func narrationCacheKey(req dto.StackNarrationRequest) string {
	payload := map[string]any{
		"request":       req,
		"model":         config.App.LLMModel,
		"promptVersion": narrationPromptVersion,
	}
	data, _ := json.Marshal(payload)
	sum := sha256.Sum256(data)
	return fmt.Sprintf("%x", sum)
}

// ---------- Prompt 构建 ----------

func buildNarrationPrompt(req dto.StackNarrationRequest) string {
	stackData, _ := json.Marshal(req)
	var stackMap any
	_ = json.Unmarshal(stackData, &stackMap)
	stackJSON, _ := json.MarshalIndent(stackMap, "", "  ")

	metaJSON, _ := json.MarshalIndent(selectedMeta(req), "", "  ")

	tmpl := promptTemplate()
	tmpl = strings.ReplaceAll(tmpl, "{STACK_JSON}", string(stackJSON))
	tmpl = strings.ReplaceAll(tmpl, "{TECH_META_JSON}", string(metaJSON))
	return tmpl
}

// ---------- 本地回退 ----------

func mainItemByRole(items []dto.StackItem, role string) string {
	for _, it := range items {
		if it.Role == role {
			return it.Name
		}
	}
	if len(items) > 0 {
		return items[0].Name
	}
	return "未知"
}

func narrateFallback(req dto.StackNarrationRequest) dto.StackNarration {
	frontend := mainItemByRole(req.Frontend.Items, "framework")
	frontendLang := mainItemByRole(req.Frontend.Items, "language")
	styling := mainItemByRole(req.Frontend.Items, "styling")
	backend := mainItemByRole(req.Backend.Items, "framework")
	backendLang := mainItemByRole(req.Backend.Items, "language")
	database := mainItemByRole(req.Backend.Items, "database")

	title := frontend + " + " + backend + " + " + database
	narrative := frontend + "、" + frontendLang + " 和 " + styling +
		" 让胶囊创建、广场筛选这类交互保持组件化、类型可追踪和令牌化样式约束；" +
		backend + " 与 " + backendLang +
		" 则把请求校验、OpenAPI 合同和并发处理显式放在接口边界上，" +
		"再交给 " + database + " 的事务模型承载刷新令牌、收藏计数和解锁时间等一致性要求。" +
		"这组栈的教学重点不是各技术单点能力，而是观察 UI 状态、接口契约、迁移和数据约束如何互相校准；" +
		"收益是边界清晰、替换后端容易，成本是类型、错误处理和数据演进都需要持续维护。"

	return dto.StackNarration{
		Title:       title,
		Narrative:   narrative,
		GeneratedBy: "local-template",
		Cached:      false,
	}
}

// ---------- 主入口 ----------

// NarrateStack 生成或从缓存获取技术栈叙述。
// LLM 启用时调用 LLM，失败回退到本地模板；LLM 禁用时直接返回本地模板。
func NarrateStack(req dto.StackNarrationRequest) dto.StackNarration {
	key := narrationCacheKey(req)

	// 先查缓存（读锁）
	narrationCacheMu.RLock()
	if cached, ok := narrationCache[key]; ok {
		narrationCacheMu.RUnlock()
		cached.Cached = true
		return cached
	}
	narrationCacheMu.RUnlock()

	// 调用 LLM
	generated, err := GenerateStructuredNarration(buildNarrationPrompt(req))

	var result dto.StackNarration
	if err != nil {
		log.Printf("[narration] LLM failed, using local fallback: %v", err)
		result = narrateFallback(req)
	} else {
		title, _ := generated["title"].(string)
		narrative, _ := generated["narrative"].(string)
		result = dto.StackNarration{
			Title:       strings.TrimSpace(title),
			Narrative:   strings.TrimSpace(narrative),
			GeneratedBy: config.App.LLMProvider + ":" + config.App.LLMModel,
			Cached:      false,
		}
	}

	// 写入缓存（写锁）
	narrationCacheMu.Lock()
	narrationCache[key] = result
	narrationCacheMu.Unlock()

	return result
}
