use chrono::{Duration, Utc};
use rand::seq::SliceRandom;
use regex::Regex;
use serde_json::{json, Value};
use std::sync::OnceLock;

use crate::infra::iso_date;
use crate::services::llm;
use crate::state::AppState;
use crate::web::error::{ApiError, ApiResult};
use crate::web::requests::CapsuleSuggestionRequest;

/// 由标题生成胶囊正文与开启天数建议。LLM 不可用时本地兜底（generatedBy=local-template）。

pub async fn suggest(state: &AppState, req: &CapsuleSuggestionRequest) -> ApiResult<Value> {
    if let Some(title) = &req.title {
        if title.chars().count() > 60 {
            return Err(ApiError::validation("标题长度不得超过 60", "title"));
        }
    }
    let title = req.title.as_deref().unwrap_or("").trim().to_string();
    let auto_title = title.is_empty();

    let mut generated_by = "local-template".to_string();
    let mut result_title: Option<String> = None;
    let content: String;
    let days: i64;

    match try_llm(state, &title, auto_title).await {
        Ok((t, c, d)) => {
            result_title = t;
            content = c;
            days = d;
            generated_by = format!("{}:{}", state.config.llm.provider, state.config.llm.model);
        }
        Err(e) => {
            tracing::warn!("Capsule suggestion LLM failed; using local fallback: {}", e.message);
            let fb = fallback(auto_title, &title);
            if auto_title {
                result_title = Some(fb.title);
            }
            content = fb.content;
            days = fb.days;
        }
    }

    let open_at = Utc::now() + Duration::seconds(days * 86400);
    Ok(json!({
        "title": result_title,
        "content": content,
        "openInDays": days,
        "openAt": iso_date::json_string(&open_at),
        "generatedBy": generated_by,
        "cached": false,
    }))
}

/// LLM 路径：返回 (autoTitle 时的标题, 正文, 天数)。
async fn try_llm(
    state: &AppState,
    title: &str,
    auto_title: bool,
) -> Result<(Option<String>, String, i64), llm::LlmError> {
    let node = llm::generate_capsule_suggestion(state, &build_prompt(state, title)).await?;
    let mut raw_content = node
        .get("content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if raw_content.chars().count() > 5000 {
        raw_content = raw_content.chars().take(5000).collect();
    }
    if raw_content.is_empty() {
        return Err(llm::LlmError::new("LLM returned empty content"));
    }
    let Some(raw_days) = node.get("openInDays").and_then(llm::value_as_i64) else {
        return Err(llm::LlmError::new("openInDays missing or not a number"));
    };
    let result_title = if auto_title {
        let gen_title = clean_title(node.get("title").and_then(|v| v.as_str()));
        if gen_title.is_empty() {
            return Err(llm::LlmError::new("LLM returned empty title in auto-title mode"));
        }
        Some(gen_title)
    } else {
        None
    };
    Ok((result_title, raw_content, raw_days.clamp(1, 3650)))
}

fn build_prompt(state: &AppState, title: &str) -> String {
    let template = if state.suggestion_template.is_empty() {
        DEFAULT_PROMPT_TEMPLATE
    } else {
        &state.suggestion_template
    };
    template.replace("{TITLE_OR_EMPTY}", title).replace("{TITLE}", title)
}

/// 清洗 LLM 标题：去换行 / 围栏符号 / 引号书名号，截到 60。
pub fn clean_title(raw: Option<&str>) -> String {
    static NEWLINES: OnceLock<Regex> = OnceLock::new();
    static HEAD: OnceLock<Regex> = OnceLock::new();
    static TAIL: OnceLock<Regex> = OnceLock::new();
    let newlines = NEWLINES.get_or_init(|| Regex::new(r"[\r\n]+").unwrap());
    let head = HEAD.get_or_init(|| Regex::new("^[#*`　 \"'《》【】]+").unwrap());
    let tail = TAIL.get_or_init(|| Regex::new("[#*`　 \"'《》【】]+$").unwrap());

    let s = newlines.replace_all(raw.unwrap_or("").trim(), " ").to_string();
    let s = tail.replace(&head.replace(&s, ""), "").trim().to_string();
    if s.chars().count() > 60 {
        s.chars().take(60).collect()
    } else {
        s
    }
}

// ── 本地兜底 ─────────────────────────────────────────────────────────────────

pub struct Fallback {
    pub title: String,
    pub content: String,
    pub days: i64,
}

pub fn fallback(auto_title: bool, title: &str) -> Fallback {
    if auto_title {
        let pick = FALLBACK_CAPSULES.choose(&mut rand::thread_rng()).unwrap();
        return Fallback {
            title: pick.0.to_string(),
            content: pick.1.to_string(),
            days: pick.2,
        };
    }
    let days = *[30i64, 90, 180, 365].choose(&mut rand::thread_rng()).unwrap();
    let content = format!(
        "写下《{title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。\
         如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n\
         我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、\
         正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n\
         记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。"
    );
    Fallback { title: title.to_string(), content, days }
}

const DEFAULT_PROMPT_TEMPLATE: &str =
    "你是中文写作助手。胶囊标题为 {TITLE_OR_EMPTY}（可能为空，为空时请先构思一个 1~18 字中文标题）。\
     为用户生成一段 260~400 字的时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。\
     只返回严格 JSON：{\"title\":\"...\",\"content\":\"...\",\"openInDays\":30}。";

/// (title, content, days)
const FALLBACK_CAPSULES: &[(&str, &str, i64)] = &[
    (
        "写给一个月后的自己",
        "此刻的我有点想对一个月后的你说说话。不知道那时的天气怎么样，你手边在忙些什么，\
         有没有把现在挂在心上的那件小事做完。我想记住今天的样子：略显疲惫，却还愿意期待。\n\n\
         如果这一个月过得顺利，那就好好奖励自己一次；如果有些计划落了空，也别太苛责，\
         你已经在往前走了。记得多喝水，记得早点睡，记得偶尔抬头看看窗外。我们一个月后见。",
        30,
    ),
    (
        "下个季度想完成的一件事",
        "我想把一件一直拖着的事认真做完，所以把它写进这封信里，让未来的你来检查。\
         现在的我还在犹豫，担心做不好，担心时间不够；但比起完美，我更怕一直停在原地。\n\n\
         等你读到这段话时，希望那件事已经有了眉目——哪怕只是迈出了第一步。\
         无论结果如何，请记得为当初愿意开始的自己鼓一次掌。",
        90,
    ),
    (
        "猜猜下届世界杯冠军是谁",
        "趁着还没揭晓，我想先把心里押注的那支球队写下来，等结果出来再回头验证我的眼光。\
         此刻的我对足球的热情正浓，会为一个进球大喊，也会为一次失误叹气。\n\n\
         等这封信开启的时候，冠军应该已经诞生了吧。不管我猜得对不对，\
         希望那段为热爱呐喊的日子，依然让你觉得值得。",
        365,
    ),
    (
        "明年生日想对自己说的话",
        "又长了一岁的你，过得还好吗？我在今天提前为你写下这封信，想问问你有没有变成\
         自己喜欢的样子。也许你完成了一些心愿，也许还有遗憾，但这都没关系。\n\n\
         请记得今天的心情：对未来既忐忑又期待。生日快乐，愿你被爱，也愿你爱人。",
        365,
    ),
    (
        "三年后还在做喜欢的事吗",
        "三年说长不长，说短不短。我把现在最热爱的事写下来，想知道未来的你有没有把它坚持下去。\
         此刻它带给我很多快乐，也带来一些迷茫。\n\n\
         如果你还在做它，恭喜你守住了热爱；如果换了方向，也希望那是更适合你的选择。\
         无论如何，别忘了当初让你眼睛发亮的那个瞬间。",
        1095,
    ),
    (
        "五年后的我在哪座城市",
        "我常常好奇五年后会在哪里醒来：是熟悉的故乡，还是某个还没去过的城市？\
         此刻的我对未来有许多想象，也有一点不安。\n\n\
         等你打开这封信，请替现在的我看看窗外——那是我们一起走到的地方。\
         不管落脚在哪，希望你过得踏实、自在。",
        1825,
    ),
    (
        "十年后还在听同一首歌吗",
        "现在循环播放的那首歌，几乎成了这段日子的背景音。我想把它悄悄寄给十年后的你，\
         看看那时的你听到它，会想起什么。\n\n\
         十年很长，足够很多东西改变。但有些旋律会一直留在心里，\
         像一枚不会褪色的书签。愿你听到它时，仍能会心一笑。",
        3650,
    ),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_title_strips_markers_and_truncates() {
        assert_eq!(clean_title(Some("《写给未来》")), "写给未来");
        assert_eq!(clean_title(Some("# 标题\n第二行")), "标题 第二行");
        assert_eq!(clean_title(Some("  \"quoted\"  ")), "quoted");
        assert_eq!(clean_title(None), "");
        let long = "好".repeat(80);
        assert_eq!(clean_title(Some(&long)).chars().count(), 60);
    }

    #[test]
    fn fallback_with_title_keeps_title() {
        let fb = fallback(false, "我的标题");
        assert_eq!(fb.title, "我的标题");
        assert!(fb.content.contains("我的标题"));
        assert!([30, 90, 180, 365].contains(&fb.days));
    }

    #[test]
    fn fallback_auto_title_picks_template() {
        let fb = fallback(true, "");
        assert!(!fb.title.is_empty());
        assert!(!fb.content.is_empty());
        assert!((1..=3650).contains(&fb.days));
    }
}
