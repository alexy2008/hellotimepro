use std::time::Instant;

use serde_json::{json, Value};

use crate::state::AppState;

/// 结构化 JSON 生成的 LLM 客户端。日志规范、网关重试、CF 1010 等坑见 docs/dev-notes.md §3。
/// 契约测试默认 LLM_ENABLED=false，会在此立即返回错误，由上层走本地兜底；HTTP 路径不在测试链上。

#[derive(Debug)]
pub struct LlmError {
    pub message: String,
    pub status: u16,
}

impl LlmError {
    pub fn new(message: impl Into<String>) -> Self {
        LlmError { message: message.into(), status: 0 }
    }
}

pub struct SchemaSpec {
    pub schema_name: &'static str,
    pub schema: Value,
    pub system_prompt: &'static str,
    pub max_output_tokens: i64,
    pub max_tokens: i64,
}

pub async fn generate_capsule_suggestion(state: &AppState, prompt: &str) -> Result<Value, LlmError> {
    generate_structured_json(state, prompt, &suggestion_spec()).await
}

pub async fn generate_capsule_recommendations(
    state: &AppState,
    prompt: &str,
) -> Result<Value, LlmError> {
    generate_structured_json(state, prompt, &recommendation_spec()).await
}

async fn generate_structured_json(
    state: &AppState,
    prompt: &str,
    spec: &SchemaSpec,
) -> Result<Value, LlmError> {
    let llm = &state.config.llm;
    if !llm.enabled || llm.api_key.is_empty() {
        return Err(LlmError::new("LLM is disabled or missing API key"));
    }
    match llm.api_style.as_str() {
        "responses" => generate_with_responses(state, prompt, spec).await,
        "auto" => match generate_with_responses(state, prompt, spec).await {
            Ok(v) => Ok(v),
            Err(e) => {
                tracing::info!(
                    "Responses API unavailable ({}); falling back to chat completions",
                    e.message
                );
                generate_with_chat(state, prompt, spec, true).await
            }
        },
        _ => generate_with_chat(state, prompt, spec, true).await,
    }
}

async fn generate_with_responses(
    state: &AppState,
    prompt: &str,
    spec: &SchemaSpec,
) -> Result<Value, LlmError> {
    let llm = &state.config.llm;
    let payload = json!({
        "model": llm.model,
        "input": prompt,
        "max_output_tokens": spec.max_output_tokens,
        "text": {
            "format": {
                "type": "json_schema",
                "name": spec.schema_name,
                "strict": true,
                "schema": spec.schema,
            },
        },
    });
    let body = post_json(state, &responses_url(state), &payload).await?;
    parse_json_object(&extract_responses_text(&body)?)
}

async fn generate_with_chat(
    state: &AppState,
    prompt: &str,
    spec: &SchemaSpec,
    disable_thinking: bool,
) -> Result<Value, LlmError> {
    let llm = &state.config.llm;
    let payload = |with_thinking: bool| {
        let mut obj = json!({
            "model": llm.model,
            "messages": [
                {"role": "system", "content": spec.system_prompt},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": spec.max_tokens,
        });
        if with_thinking {
            obj["thinking"] = json!({"type": "disabled"});
        }
        obj
    };
    match post_json(state, &chat_url(state), &payload(disable_thinking)).await {
        Ok(body) => parse_json_object(&extract_chat_text(&body)?),
        Err(e) if e.status == 400 && disable_thinking => {
            // 某些网关不认 thinking 字段，去掉重试一次。
            let body = post_json(state, &chat_url(state), &payload(false)).await?;
            parse_json_object(&extract_chat_text(&body)?)
        }
        Err(e) => Err(e),
    }
}

/// 向 url POST JSON；瞬时网络/TLS 错误按配置重试，HTTP 4xx/5xx 与坏 JSON 不重试。
async fn post_json(state: &AppState, url: &str, payload: &Value) -> Result<Value, LlmError> {
    let llm = &state.config.llm;
    let attempts = llm.max_retries.max(0) + 1;
    let mut last_error = String::new();

    for attempt in 1..=attempts {
        tracing::info!(
            "LLM request  model={} url={} attempt={}/{}",
            llm.model, url, attempt, attempts
        );
        let start = Instant::now();
        let sent = state
            .http
            .post(url)
            .header("Authorization", format!("Bearer {}", llm.api_key))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("User-Agent", &llm.user_agent)
            .json(payload)
            .send()
            .await;
        let elapsed = start.elapsed().as_millis();

        match sent {
            Ok(response) => {
                let status = response.status().as_u16();
                if !(200..300).contains(&status) {
                    tracing::warn!(
                        "LLM error    model={} elapsed_ms={} status={}",
                        llm.model, elapsed, status
                    );
                    let body_text = response.text().await.unwrap_or_default();
                    let prefix: String = body_text.chars().take(500).collect();
                    return Err(LlmError { message: format!("HTTP {status}: {prefix}"), status });
                }
                let Ok(parsed) = response.json::<Value>().await else {
                    tracing::warn!(
                        "LLM error    model={} elapsed_ms={} error=invalid-json",
                        llm.model, elapsed
                    );
                    return Err(LlmError::new("LLM response was not valid JSON"));
                };
                if !parsed.is_object() {
                    tracing::warn!(
                        "LLM error    model={} elapsed_ms={} error=invalid-json",
                        llm.model, elapsed
                    );
                    return Err(LlmError::new("LLM response was not a JSON object"));
                }
                tracing::info!(
                    "LLM response model={} elapsed_ms={} tokens={}",
                    llm.model, elapsed, extract_tokens(&parsed)
                );
                return Ok(parsed);
            }
            Err(e) => {
                let will_retry = attempt < attempts;
                tracing::warn!(
                    "LLM error    model={} elapsed_ms={} error={}{}",
                    llm.model, elapsed, e,
                    if will_retry { " (will retry)" } else { "" }
                );
                last_error = e.to_string();
                if will_retry {
                    tokio::time::sleep(std::time::Duration::from_millis(
                        llm.retry_backoff_ms * attempt as u64,
                    ))
                    .await;
                }
            }
        }
    }
    Err(LlmError::new(if last_error.is_empty() {
        "LLM request failed".to_string()
    } else {
        last_error
    }))
}

fn extract_tokens(body: &Value) -> String {
    let Some(usage) = body.get("usage").and_then(|v| v.as_object()) else {
        return "n/a".to_string();
    };
    if let Some(total) = usage.get("total_tokens").and_then(value_as_i64) {
        if total > 0 {
            return total.to_string();
        }
    }
    let sum = usage.get("input_tokens").and_then(value_as_i64).unwrap_or(0)
        + usage.get("output_tokens").and_then(value_as_i64).unwrap_or(0);
    if sum > 0 {
        sum.to_string()
    } else {
        "n/a".to_string()
    }
}

fn extract_chat_text(body: &Value) -> Result<String, LlmError> {
    body.get("choices")
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .ok_or_else(|| LlmError::new("LLM chat response missing content"))
}

fn extract_responses_text(body: &Value) -> Result<String, LlmError> {
    if let Some(text) = body.get("output_text").and_then(|v| v.as_str()) {
        if !text.is_empty() {
            return Ok(text.to_string());
        }
    }
    for item in body.get("output").and_then(|v| v.as_array()).unwrap_or(&Vec::new()) {
        for entry in item.get("content").and_then(|v| v.as_array()).unwrap_or(&Vec::new()) {
            if let Some(text) = entry.get("text").and_then(|v| v.as_str()) {
                if !text.is_empty() {
                    return Ok(text.to_string());
                }
            }
        }
    }
    Err(LlmError::new("LLM response did not contain output text"))
}

/// 解析 LLM 输出的 JSON 对象：剥代码块围栏；失败时截取首尾花括号再试一次。
pub fn parse_json_object(raw: &str) -> Result<Value, LlmError> {
    let mut text = raw.trim().to_string();
    if text.starts_with("```") {
        let re_head = regex::Regex::new(r"^```[a-zA-Z]*\s*").unwrap();
        let re_tail = regex::Regex::new(r"\s*```$").unwrap();
        text = re_tail.replace(&re_head.replace(&text, ""), "").trim().to_string();
    }
    if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
        if parsed.is_object() {
            return Ok(parsed);
        }
    }
    let (Some(start), Some(end)) = (text.find('{'), text.rfind('}')) else {
        return Err(LlmError::new("LLM output was not valid JSON"));
    };
    if start >= end {
        return Err(LlmError::new("LLM output was not valid JSON"));
    }
    match serde_json::from_str::<Value>(&text[start..=end]) {
        Ok(parsed) if parsed.is_object() => Ok(parsed),
        _ => Err(LlmError::new("LLM output was not valid JSON")),
    }
}

/// 宽容的整数读取：LLM 偶尔返回 `30.0` 这类浮点形态。
pub fn value_as_i64(v: &Value) -> Option<i64> {
    v.as_i64().or_else(|| v.as_f64().filter(|f| f.is_finite()).map(|f| f as i64))
}

fn base_url(state: &AppState) -> String {
    let trimmed = state.config.llm.base_url.trim();
    if trimmed.is_empty() {
        return "https://api.openai.com/v1".to_string();
    }
    trimmed.trim_end_matches('/').to_string()
}

fn responses_url(state: &AppState) -> String {
    format!("{}/responses", base_url(state))
}

fn chat_url(state: &AppState) -> String {
    format!("{}/chat/completions", base_url(state))
}

// ── 结构化输出 schema ───────────────────────────────────────────────────────

pub fn suggestion_spec() -> SchemaSpec {
    SchemaSpec {
        schema_name: "capsule_suggestion",
        schema: json!({
            "type": "object",
            "additionalProperties": false,
            "required": ["title", "content", "openInDays"],
            "properties": {
                "title": {"type": "string"},
                "content": {"type": "string"},
                "openInDays": {"type": "integer", "minimum": 1, "maximum": 3650},
            },
        }),
        system_prompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。\
            JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。",
        max_output_tokens: 900,
        max_tokens: 900,
    }
}

pub fn recommendation_spec() -> SchemaSpec {
    SchemaSpec {
        schema_name: "capsule_recommendations",
        schema: json!({
            "type": "object",
            "additionalProperties": false,
            "required": ["items"],
            "properties": {
                "items": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 8,
                    "items": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["title", "hint", "openInDays"],
                        "properties": {
                            "title": {"type": "string"},
                            "hint": {"type": "string"},
                            "openInDays": {"type": "integer", "minimum": 1, "maximum": 3650},
                        },
                    },
                },
            },
        }),
        system_prompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。\
            JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
        max_output_tokens: 900,
        max_tokens: 900,
    }
}
