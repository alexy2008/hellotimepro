"""根据标题生成胶囊正文与开启天数建议。"""

from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone

from app.core.config import REPO_ROOT, settings
from app.schemas.capsule_suggestion import CapsuleSuggestion, CapsuleSuggestionRequest
from app.services.llm_client import LlmClientError, generate_capsule_suggestion

logger = logging.getLogger(__name__)


def _prompt_template() -> str:
    path = REPO_ROOT / "spec" / "llm" / "capsule-suggestion.prompt.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return (
        "你是中文写作助手。基于标题 {TITLE} 为用户生成一段 260~400 字的"
        "时光胶囊正文（content），并给出建议的开启天数（openInDays，1~3650 整数）。"
        "只返回严格 JSON：{\"content\":\"...\",\"openInDays\":30}。"
    )


def _build_prompt(title: str) -> str:
    return _prompt_template().replace("{TITLE}", title)


def _coerce_open_in_days(raw: object) -> int:
    if isinstance(raw, bool):
        raise ValueError("openInDays must be integer")
    if isinstance(raw, int):
        days = raw
    elif isinstance(raw, float):
        days = int(raw)
    elif isinstance(raw, str):
        days = int(raw.strip())
    else:
        raise ValueError("openInDays must be integer")
    if days < 1:
        days = 1
    if days > 3650:
        days = 3650
    return days


def _truncate_content(text: str) -> str:
    text = text.strip()
    if len(text) > 5000:
        return text[:5000]
    return text


def _local_fallback(title: str) -> tuple[str, int]:
    """LLM 不可用时的本地兜底：用标题拼出温和的内容、随机一段时间窗口。"""
    days = random.choice([30, 90, 180, 365])
    content = (
        f"写下《{title}》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。"
        "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n"
        "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、"
        "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n"
        "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。"
    )
    return content, days


def suggest_capsule(req: CapsuleSuggestionRequest) -> CapsuleSuggestion:
    title = req.title.strip()
    generated_by = "local-template"
    content: str
    days: int

    try:
        result = generate_capsule_suggestion(_build_prompt(title))
        content = _truncate_content(str(result["content"]))
        days = _coerce_open_in_days(result["openInDays"])
        if not content:
            raise ValueError("empty content from LLM")
        generated_by = f"{settings.llm_provider}:{settings.llm_model}"
    except (KeyError, TypeError, ValueError, LlmClientError) as e:
        logger.warning("Capsule suggestion LLM failed; using local fallback: %s", e)
        content, days = _local_fallback(title)

    open_at = datetime.now(timezone.utc) + timedelta(days=days)
    return CapsuleSuggestion(
        content=content,
        openInDays=days,
        openAt=open_at,
        generatedBy=generated_by,
        cached=False,
    )
