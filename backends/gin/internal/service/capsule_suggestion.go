// Package service — capsule_suggestion.go 根据用户给定的标题生成胶囊正文与开启天数建议。
package service

import (
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"hellotime/gin/internal/config"
	"hellotime/gin/internal/dto"
)

// ---------- 提示词模板 ----------

func capsulePromptTemplate() string {
	path := filepath.Join(config.App.RepoRoot, "spec", "llm", "capsule-suggestion.prompt.md")
	data, err := os.ReadFile(path)
	if err == nil {
		return string(data)
	}
	return `你是中文写作助手。基于标题 {TITLE} 为用户生成一段 260~400 字的时光胶囊正文（content），` +
		`并给出建议的开启天数（openInDays，1~3650 整数）。` +
		`只返回严格 JSON：{"content":"...","openInDays":30}。`
}

func buildCapsuleSuggestionPrompt(title string) string {
	return strings.ReplaceAll(capsulePromptTemplate(), "{TITLE}", title)
}

// ---------- 工具：openInDays 归一化 ----------

// coerceOpenInDays 把 LLM 返回的 openInDays 转为有效整数；越界则裁剪到 1~3650。
func coerceOpenInDays(raw any) (int, bool) {
	var days int
	switch v := raw.(type) {
	case float64:
		days = int(v)
	case int:
		days = v
	case int64:
		days = int(v)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil {
			return 0, false
		}
		days = parsed
	default:
		return 0, false
	}
	if days < 1 {
		days = 1
	}
	if days > 3650 {
		days = 3650
	}
	return days, true
}

// ---------- 本地兜底 ----------

func capsuleFallback(title string) (string, int) {
	candidates := []int{30, 90, 180, 365}
	days := candidates[rand.Intn(len(candidates))]
	content := "写下《" + title + "》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。" +
		"如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n" +
		"我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、" +
		"正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n" +
		"记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。"
	return content, days
}

// ---------- 主入口 ----------

// SuggestCapsule 根据标题生成胶囊正文与开启时间建议。LLM 失败时回退本地模板。
func SuggestCapsule(req dto.CapsuleSuggestionRequest) dto.CapsuleSuggestion {
	title := strings.TrimSpace(req.Title)
	generatedBy := "local-template"

	var content string
	var days int

	result, err := GenerateCapsuleSuggestion(buildCapsuleSuggestionPrompt(title))
	if err != nil {
		log.Printf("[capsule-suggestion] LLM failed, using local fallback: %v", err)
		content, days = capsuleFallback(title)
	} else {
		text, _ := result["content"].(string)
		text = strings.TrimSpace(text)
		if len(text) > 5000 {
			text = text[:5000]
		}
		coerced, ok := coerceOpenInDays(result["openInDays"])
		if text == "" || !ok {
			log.Printf("[capsule-suggestion] LLM payload invalid, using fallback")
			content, days = capsuleFallback(title)
		} else {
			content = text
			days = coerced
			generatedBy = config.App.LLMProvider + ":" + config.App.LLMModel
		}
	}

	openAt := time.Now().UTC().Add(time.Duration(days) * 24 * time.Hour)
	return dto.CapsuleSuggestion{
		Content:     content,
		OpenInDays:  days,
		OpenAt:      openAt,
		GeneratedBy: generatedBy,
		Cached:      false,
	}
}
