use std::collections::HashSet;

use regex::Regex;
use serde_json::{json, Value};
use std::sync::OnceLock;

use crate::services::llm;
use crate::state::AppState;

/// 创建页 AI 推荐主题。锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。

pub const MIN_ITEMS: i64 = 3;
pub const MAX_ITEMS: i64 = 8;

pub async fn get_recommendations(state: &AppState, count: i64, _locale: &str) -> Value {
    let n = count.clamp(MIN_ITEMS, MAX_ITEMS);
    let items = match llm::generate_capsule_recommendations(state, &build_prompt(state, n)).await {
        Ok(node) => parse_items(node.get("items"), n as usize),
        Err(e) => {
            tracing::info!("Capsule recommendations unavailable; returning empty list: {}", e.message);
            Vec::new()
        }
    };
    let generated_by = if items.is_empty() {
        "none".to_string()
    } else {
        format!("{}:{}", state.config.llm.provider, state.config.llm.model)
    };
    json!({
        "items": items,
        "generatedBy": generated_by,
        "cached": false,
    })
}

fn build_prompt(state: &AppState, count: i64) -> String {
    let template = if state.recommendation_template.is_empty() {
        DEFAULT_PROMPT_TEMPLATE
    } else {
        &state.recommendation_template
    };
    template.replace("{COUNT}", &count.to_string())
}

pub fn parse_items(raw: Option<&Value>, limit: usize) -> Vec<Value> {
    let Some(array) = raw.and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    let mut items = Vec::new();
    let mut seen = HashSet::new();
    for entry in array {
        let title = clean(entry.get("title").and_then(|v| v.as_str()), 60);
        let hint = clean(entry.get("hint").and_then(|v| v.as_str()), 80);
        let Some(raw_days) = entry.get("openInDays").and_then(llm::value_as_i64) else {
            continue;
        };
        if title.is_empty() || hint.is_empty() || seen.contains(&title) {
            continue;
        }
        seen.insert(title.clone());
        items.push(json!({
            "title": title,
            "hint": hint,
            "openInDays": raw_days.clamp(1, 3650),
        }));
        if items.len() >= limit {
            break;
        }
    }
    items
}

fn clean(raw: Option<&str>, limit: usize) -> String {
    static NEWLINES: OnceLock<Regex> = OnceLock::new();
    static HEAD: OnceLock<Regex> = OnceLock::new();
    static TAIL: OnceLock<Regex> = OnceLock::new();
    let newlines = NEWLINES.get_or_init(|| Regex::new(r"[\r\n]+").unwrap());
    let head = HEAD.get_or_init(|| Regex::new("^[#*`　 \"'《》【】]+").unwrap());
    let tail = TAIL.get_or_init(|| Regex::new("[#*`　 \"'《》【】]+$").unwrap());

    let s = newlines.replace_all(raw.unwrap_or("").trim(), " ").to_string();
    let s = tail.replace(&head.replace(&s, ""), "").trim().to_string();
    if s.chars().count() > limit {
        s.chars().take(limit).collect()
    } else {
        s
    }
}

const DEFAULT_PROMPT_TEMPLATE: &str =
    "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。\
     每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。\
     只返回严格 JSON：{\"items\":[{\"title\":\"...\",\"hint\":\"...\",\"openInDays\":30}]}。";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_items_dedups_and_clamps() {
        let raw = json!([
            {"title": "主题A", "hint": "提示A", "openInDays": 30},
            {"title": "主题A", "hint": "重复标题应被去重", "openInDays": 60},
            {"title": "主题B", "hint": "提示B", "openInDays": 99999},
            {"title": "", "hint": "空标题应被跳过", "openInDays": 30},
            {"title": "主题C", "hint": "缺天数应被跳过"},
            {"title": "主题D", "hint": "提示D", "openInDays": 10.0},
        ]);
        let items = parse_items(Some(&raw), 8);
        assert_eq!(items.len(), 3);
        assert_eq!(items[0]["title"], "主题A");
        assert_eq!(items[1]["openInDays"], 3650); // clamp 上限
        assert_eq!(items[2]["title"], "主题D");
        assert_eq!(items[2]["openInDays"], 10); // 容忍 10.0 浮点形态
    }

    #[test]
    fn parse_items_respects_limit() {
        let raw = json!([
            {"title": "A", "hint": "a", "openInDays": 1},
            {"title": "B", "hint": "b", "openInDays": 2},
            {"title": "C", "hint": "c", "openInDays": 3},
        ]);
        assert_eq!(parse_items(Some(&raw), 2).len(), 2);
        assert!(parse_items(None, 8).is_empty());
    }
}
