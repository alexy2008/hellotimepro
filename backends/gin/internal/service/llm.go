// Package service — llm.go 提供 OpenAI 兼容的 LLM HTTP 客户端。
// 先尝试 /responses API（Responses API），失败后回退到 /chat/completions。
package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"hellotime/gin/internal/config"
)

// ---------- 错误类型 ----------

// LLMClientError 记录 LLM 调用失败信息；Status 为 0 表示非 HTTP 错误。
type LLMClientError struct {
	Message string
	Status  int
}

func (e *LLMClientError) Error() string {
	if e.Status != 0 {
		return fmt.Sprintf("HTTP %d: %s", e.Status, e.Message)
	}
	return e.Message
}

func llmClientErr(msg string) *LLMClientError    { return &LLMClientError{Message: msg} }
func llmHTTPErr(status int, msg string) *LLMClientError {
	return &LLMClientError{Status: status, Message: msg}
}

// ---------- URL 工具 ----------

func responsesURL() string {
	return strings.TrimRight(config.App.LLMBaseURL, "/") + "/responses"
}

func chatCompletionsURL() string {
	return strings.TrimRight(config.App.LLMBaseURL, "/") + "/chat/completions"
}

// ---------- 响应解析 ----------

// extractText 从 /responses API 响应体中提取文本。
func extractText(body map[string]any) (string, error) {
	if t, ok := body["output_text"].(string); ok && strings.TrimSpace(t) != "" {
		return t, nil
	}
	if output, ok := body["output"].([]any); ok {
		for _, item := range output {
			itemMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			contents, ok := itemMap["content"].([]any)
			if !ok {
				continue
			}
			for _, c := range contents {
				cMap, ok := c.(map[string]any)
				if !ok {
					continue
				}
				if text, ok := cMap["text"].(string); ok && text != "" {
					return text, nil
				}
			}
		}
	}
	return "", llmClientErr("LLM response did not contain output text")
}

// extractChatText 从 /chat/completions 响应体中提取文本。
func extractChatText(body map[string]any) (string, error) {
	choices, ok := body["choices"].([]any)
	if !ok || len(choices) == 0 {
		return "", llmClientErr("LLM chat response did not contain choices")
	}
	first, ok := choices[0].(map[string]any)
	if !ok {
		return "", llmClientErr("LLM chat response invalid choice format")
	}
	message, ok := first["message"].(map[string]any)
	if !ok {
		return "", llmClientErr("LLM chat response missing message")
	}
	content, ok := message["content"].(string)
	if !ok || strings.TrimSpace(content) == "" {
		return "", llmClientErr("LLM chat response did not contain message content")
	}
	return content, nil
}

// parseJSONObject 去除可能的 Markdown 代码块，然后解析 JSON 对象。
func parseJSONObject(text string) (map[string]any, error) {
	raw := strings.TrimSpace(text)
	if strings.HasPrefix(raw, "```") {
		raw = strings.TrimLeft(raw, "`")
		raw = strings.TrimSpace(raw)
		if strings.HasPrefix(strings.ToLower(raw), "json") {
			raw = raw[4:]
			raw = strings.TrimSpace(raw)
		}
		// 去掉末尾可能残留的 ```
		raw = strings.TrimRight(raw, "`")
		raw = strings.TrimSpace(raw)
	}
	var result map[string]any
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		// 尝试从文本中提取 JSON 对象
		start := strings.Index(raw, "{")
		end := strings.LastIndex(raw, "}")
		if start == -1 || end == -1 || end <= start {
			return nil, err
		}
		if err2 := json.Unmarshal([]byte(raw[start:end+1]), &result); err2 != nil {
			return nil, err2
		}
	}
	return result, nil
}

// ---------- HTTP 请求 ----------

func httpClient() *http.Client {
	return &http.Client{Timeout: time.Duration(config.App.LLMTimeoutMs) * time.Millisecond}
}

// extractTokens 从响应体的 usage 字段尽力读取 token 用量，读不到返回 "n/a"。
func extractTokens(body map[string]any) string {
	usage, ok := body["usage"].(map[string]any)
	if !ok {
		return "n/a"
	}
	num := func(key string) float64 {
		if v, ok := usage[key].(float64); ok {
			return v
		}
		return 0
	}
	if total := num("total_tokens"); total > 0 {
		return fmt.Sprintf("%d", int(total))
	}
	if sum := num("input_tokens") + num("output_tokens"); sum > 0 {
		return fmt.Sprintf("%d", int(sum))
	}
	return "n/a"
}

// postJSON 向 url POST JSON 载荷；对瞬时网络/TLS 错误（如 SSL EOF）按配置重试，
// HTTP 4xx/5xx 等明确响应不重试。按 LLM 日志规范输出 request/response/error。
func postJSON(url string, payload map[string]any) (map[string]any, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, llmClientErr("failed to marshal request: " + err.Error())
	}
	model, _ := payload["model"].(string)

	attempts := config.App.LLMMaxRetries + 1
	if attempts < 1 {
		attempts = 1
	}

	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		log.Printf("LLM request  model=%s url=%s attempt=%d/%d", model, url, attempt, attempts)
		start := time.Now()

		req, reqErr := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
		if reqErr != nil {
			return nil, llmClientErr("failed to create request: " + reqErr.Error())
		}
		req.Header.Set("Authorization", "Bearer "+config.App.LLMAPIKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		// 避免被网关机器人防护按默认 UA 封禁（Cloudflare error 1010）
		req.Header.Set("User-Agent", config.App.LLMUserAgent)

		resp, doErr := httpClient().Do(req)
		if doErr != nil {
			// 瞬时网络/TLS 错误：在剩余次数内重试
			elapsed := time.Since(start).Milliseconds()
			willRetry := attempt < attempts
			suffix := ""
			if willRetry {
				suffix = " (will retry)"
			}
			log.Printf("LLM error    model=%s elapsed_ms=%d error=%s%s", model, elapsed, doErr, suffix)
			lastErr = llmClientErr("HTTP request failed: " + doErr.Error())
			if willRetry {
				time.Sleep(time.Duration(config.App.LLMRetryBackoffMs*attempt) * time.Millisecond)
				continue
			}
			return nil, lastErr
		}

		bodyBytes, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		elapsed := time.Since(start).Milliseconds()
		if readErr != nil {
			willRetry := attempt < attempts
			suffix := ""
			if willRetry {
				suffix = " (will retry)"
			}
			log.Printf("LLM error    model=%s elapsed_ms=%d error=%s%s", model, elapsed, readErr, suffix)
			lastErr = llmClientErr("failed to read response: " + readErr.Error())
			if willRetry {
				time.Sleep(time.Duration(config.App.LLMRetryBackoffMs*attempt) * time.Millisecond)
				continue
			}
			return nil, lastErr
		}

		if resp.StatusCode >= 400 {
			// 服务端给了明确响应（含 Cloudflare 1010）——非瞬时错误，不重试
			detail := strings.TrimSpace(string(bodyBytes))
			if len(detail) > 500 {
				detail = detail[:500]
			}
			log.Printf("LLM error    model=%s elapsed_ms=%d status=%d", model, elapsed, resp.StatusCode)
			return nil, llmHTTPErr(resp.StatusCode, detail)
		}

		var result map[string]any
		if err := json.Unmarshal(bodyBytes, &result); err != nil {
			// 拿到响应但不是合法 JSON——重试无益，直接失败
			log.Printf("LLM error    model=%s elapsed_ms=%d error=invalid-json", model, elapsed)
			return nil, llmClientErr("failed to parse response JSON: " + err.Error())
		}
		log.Printf("LLM response model=%s elapsed_ms=%d tokens=%s", model, elapsed, extractTokens(result))
		return result, nil
	}
	return nil, lastErr
}

// ---------- 结构化 JSON 生成参数 ----------

// LLMSchemaSpec 描述一次结构化 JSON 生成所需的 schema/system 信息。
type LLMSchemaSpec struct {
	SchemaName      string         // 用于 /responses API 的 json_schema 名称
	Schema          map[string]any // JSON Schema（type=object, properties=...）
	SystemPrompt    string         // /chat/completions 的 system 消息
	MaxOutputTokens int            // /responses 的 max_output_tokens
	MaxTokens       int            // /chat/completions 的 max_tokens
}

var capsuleSuggestionSpec = LLMSchemaSpec{
	SchemaName: "capsule_suggestion",
	Schema: map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		// strict 模式要求 required 覆盖全部 properties；空标题模式下服务层会用 title，
		// 已带标题时忽略它。
		"required": []string{"title", "content", "openInDays"},
		"properties": map[string]any{
			"title":      map[string]any{"type": "string"},
			"content":    map[string]any{"type": "string"},
			"openInDays": map[string]any{"type": "integer", "minimum": 1, "maximum": 3650},
		},
	},
	SystemPrompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
		"JSON 必须包含字符串字段 title、content 和整数字段 openInDays。" +
		"若用户已给出标题，title 可原样回填。",
	MaxOutputTokens: 900,
	MaxTokens:       900,
}

var capsuleRecommendationSpec = LLMSchemaSpec{
	SchemaName: "capsule_recommendations",
	Schema: map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"items"},
		"properties": map[string]any{
			"items": map[string]any{
				"type":     "array",
				"minItems": 3,
				"maxItems": 8,
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"title", "hint", "openInDays"},
					"properties": map[string]any{
						"title":      map[string]any{"type": "string"},
						"hint":       map[string]any{"type": "string"},
						"openInDays": map[string]any{"type": "integer", "minimum": 1, "maximum": 3650},
					},
				},
			},
		},
	},
	SystemPrompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
		"JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
	MaxOutputTokens: 900,
	MaxTokens:       900,
}

// ---------- /responses API ----------

func generateWithResponses(prompt string, spec LLMSchemaSpec) (map[string]any, error) {
	payload := map[string]any{
		"model":             config.App.LLMModel,
		"input":             prompt,
		"max_output_tokens": spec.MaxOutputTokens,
		"text": map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   spec.SchemaName,
				"strict": true,
				"schema": spec.Schema,
			},
		},
	}
	body, err := postJSON(responsesURL(), payload)
	if err != nil {
		return nil, err
	}
	text, err := extractText(body)
	if err != nil {
		return nil, err
	}
	return parseJSONObject(text)
}

// ---------- /chat/completions API ----------

func chatPayload(prompt string, spec LLMSchemaSpec, disableThinking bool) map[string]any {
	payload := map[string]any{
		"model": config.App.LLMModel,
		"messages": []map[string]any{
			{"role": "system", "content": spec.SystemPrompt},
			{"role": "user", "content": prompt},
		},
		"max_tokens": spec.MaxTokens,
	}
	if disableThinking {
		payload["thinking"] = map[string]any{"type": "disabled"}
	}
	return payload
}

func generateWithChatCompletions(prompt string, spec LLMSchemaSpec) (map[string]any, error) {
	body, err := postJSON(chatCompletionsURL(), chatPayload(prompt, spec, true))
	if err != nil {
		var llmE *LLMClientError
		if errors.As(err, &llmE) && llmE.Status == 400 {
			// 部分模型不接受 thinking 参数，去掉后重试
			body, err = postJSON(chatCompletionsURL(), chatPayload(prompt, spec, false))
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	text, err := extractChatText(body)
	if err != nil {
		return nil, err
	}
	return parseJSONObject(text)
}

// ---------- 统一入口 ----------

// generateStructuredJSON 通用的结构化 JSON 生成入口。按 LLM_API_STYLE 路由：
// chat（默认，多数兼容网关只支持它，跳过 /responses 省一次请求）、responses、auto。
func generateStructuredJSON(prompt string, spec LLMSchemaSpec) (map[string]any, error) {
	if !config.App.LLMEnabled || strings.TrimSpace(config.App.LLMAPIKey) == "" {
		return nil, llmClientErr("LLM is disabled or missing API key")
	}

	switch config.App.LLMAPIStyle {
	case "responses":
		return generateWithResponses(prompt, spec)
	case "auto":
		result, err := generateWithResponses(prompt, spec)
		if err == nil {
			return result, nil
		}
		log.Printf("Responses API unavailable (%v); falling back to chat completions", err)
		return generateWithChatCompletions(prompt, spec)
	default: // "chat"
		return generateWithChatCompletions(prompt, spec)
	}
}

// GenerateCapsuleSuggestion 向 LLM 请求 {title, content, openInDays} JSON 对象。
func GenerateCapsuleSuggestion(prompt string) (map[string]any, error) {
	return generateStructuredJSON(prompt, capsuleSuggestionSpec)
}

// GenerateCapsuleRecommendations 向 LLM 请求 {items:[{title,hint,openInDays}]} JSON 对象。
func GenerateCapsuleRecommendations(prompt string) (map[string]any, error) {
	return generateStructuredJSON(prompt, capsuleRecommendationSpec)
}
