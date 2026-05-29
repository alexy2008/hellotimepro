"""为创建页提供 AI 推荐的胶囊主题列表（时间跨度兼顾近远）。"""

from __future__ import annotations

import logging

from app.core.config import REPO_ROOT, settings
from app.schemas.capsule_recommendation import (
    CapsuleRecommendationItem,
    CapsuleRecommendationList,
)
from app.services.llm_client import LlmClientError, generate_capsule_recommendations

logger = logging.getLogger(__name__)

_MIN_ITEMS = 3
_MAX_ITEMS = 8


def _prompt_template() -> str:
    path = REPO_ROOT / "spec" / "llm" / "capsule-recommendation.prompt.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return (
        "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。"
        "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。"
        '只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。'
    )


def _build_prompt(count: int) -> str:
    return _prompt_template().replace("{COUNT}", str(count))


def _clamp_days(raw: object) -> int | None:
    try:
        if isinstance(raw, bool):
            return None
        if isinstance(raw, int):
            days = raw
        elif isinstance(raw, float):
            days = int(raw)
        elif isinstance(raw, str):
            days = int(raw.strip())
        else:
            return None
    except (ValueError, TypeError):
        return None
    return max(1, min(3650, days))


def _clean(text: object, limit: int) -> str:
    cleaned = str(text).strip().replace("\n", " ").replace("\r", " ")
    cleaned = cleaned.strip("#*` 　\"'《》【】")
    return cleaned[:limit].strip()


def _parse_items(raw_items: object) -> list[CapsuleRecommendationItem]:
    items: list[CapsuleRecommendationItem] = []
    seen_titles: set[str] = set()
    if not isinstance(raw_items, list):
        return items
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        title = _clean(raw.get("title", ""), 60)
        hint = _clean(raw.get("hint", ""), 80)
        days = _clamp_days(raw.get("openInDays"))
        if not title or not hint or days is None:
            continue
        if title in seen_titles:
            continue
        seen_titles.add(title)
        items.append(CapsuleRecommendationItem(title=title, hint=hint, openInDays=days))
    return items


def get_capsule_recommendations(count: int, locale: str) -> CapsuleRecommendationList:
    """推荐为锦上添花：LLM 不可用时返回空列表，不做本地兜底、不报错。"""
    count = max(_MIN_ITEMS, min(_MAX_ITEMS, count))
    items: list[CapsuleRecommendationItem] = []

    try:
        result = generate_capsule_recommendations(_build_prompt(count))
        items = _parse_items(result.get("items"))[:count]
    except (KeyError, TypeError, ValueError, LlmClientError) as e:
        logger.info("Capsule recommendations unavailable; returning empty list: %s", e)

    generated_by = f"{settings.llm_provider}:{settings.llm_model}" if items else "none"
    return CapsuleRecommendationList(items=items, generatedBy=generated_by, cached=False)
