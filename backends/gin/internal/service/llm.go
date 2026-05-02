// Package service — llm.go 提供 OpenAI 兼容的 LLM HTTP 客户端。
// 先尝试 /responses API（Responses API），失败后回退到 /chat/completions。
package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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

var llmHTTPClient = &http.Client{Timeout: 30 * time.Second}

// postJSON 向 url POST JSON 载荷，返回解析后的响应体。
func postJSON(url string, payload map[string]any) (map[string]any, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, llmClientErr("failed to marshal request: " + err.Error())
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, llmClientErr("failed to create request: " + err.Error())
	}
	req.Header.Set("Authorization", "Bearer "+config.App.LLMAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := llmHTTPClient.Do(req)
	if err != nil {
		return nil, llmClientErr("HTTP request failed: " + err.Error())
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, llmClientErr("failed to read response: " + err.Error())
	}

	if resp.StatusCode >= 400 {
		detail := strings.TrimSpace(string(bodyBytes))
		if len(detail) > 500 {
			detail = detail[:500]
		}
		return nil, llmHTTPErr(resp.StatusCode, detail)
	}

	var result map[string]any
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, llmClientErr("failed to parse response JSON: " + err.Error())
	}
	return result, nil
}

// ---------- /responses API ----------

func generateWithResponses(prompt string) (map[string]any, error) {
	payload := map[string]any{
		"model":             config.App.LLMModel,
		"input":             prompt,
		"max_output_tokens": 600,
		"text": map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   "stack_narration",
				"strict": true,
				"schema": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"title", "narrative"},
					"properties": map[string]any{
						"title":     map[string]any{"type": "string"},
						"narrative": map[string]any{"type": "string"},
					},
				},
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

func chatPayload(prompt string, disableThinking bool) map[string]any {
	payload := map[string]any{
		"model": config.App.LLMModel,
		"messages": []map[string]any{
			{
				"role": "system",
				"content": "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" +
					"JSON 必须包含字符串字段 title 和 narrative。",
			},
			{"role": "user", "content": prompt},
		},
		"max_tokens": 600,
	}
	if disableThinking {
		payload["thinking"] = map[string]any{"type": "disabled"}
	}
	return payload
}

func generateWithChatCompletions(prompt string) (map[string]any, error) {
	body, err := postJSON(chatCompletionsURL(), chatPayload(prompt, true))
	if err != nil {
		var llmE *LLMClientError
		if errors.As(err, &llmE) && llmE.Status == 400 {
			// 部分模型不接受 thinking 参数，去掉后重试
			body, err = postJSON(chatCompletionsURL(), chatPayload(prompt, false))
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

// GenerateStructuredNarration 向 LLM 请求 {title, narrative} JSON 对象。
// 先尝试 /responses，若收到 400/404/405 则回退到 /chat/completions。
func GenerateStructuredNarration(prompt string) (map[string]any, error) {
	if !config.App.LLMEnabled || strings.TrimSpace(config.App.LLMAPIKey) == "" {
		return nil, llmClientErr("LLM is disabled or missing API key")
	}

	result, err := generateWithResponses(prompt)
	if err == nil {
		return result, nil
	}
	var llmE *LLMClientError
	if errors.As(err, &llmE) && (llmE.Status == 400 || llmE.Status == 404 || llmE.Status == 405) {
		return generateWithChatCompletions(prompt)
	}
	return nil, err
}
