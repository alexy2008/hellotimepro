"""Generate a fused explanation for the currently selected stack."""

from __future__ import annotations

import hashlib
import json
import logging

from app.core.config import REPO_ROOT, settings
from app.schemas.stack_narration import StackNarration, StackNarrationRequest
from app.services.llm_client import LlmClientError, generate_structured_narration

logger = logging.getLogger(__name__)
_PROMPT_VERSION = "stack-narration-v2"
_CACHE: dict[str, StackNarration] = {}


def _prompt_template() -> str:
    path = REPO_ROOT / "spec" / "llm" / "stack-narration.prompt.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return (
        "你是一个资深全栈工程教育作者。请基于 STACK_JSON 和 TECH_META_JSON "
        "生成严格 JSON：{\"title\":\"...\",\"narrative\":\"...\"}。"
    )


def _tech_meta() -> dict:
    path = REPO_ROOT / "spec" / "tech-meta.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _selected_meta(req: StackNarrationRequest) -> dict:
    names = {item.name for item in req.frontend.items} | {item.name for item in req.backend.items}
    all_meta = _tech_meta()
    selected = {}
    for name in sorted(names):
        entry = all_meta.get(name)
        if not entry:
            continue
        selected[name] = {
            "tagline": entry.get("tagline"),
            "features": entry.get("features"),
        }
    return selected


def _request_payload(req: StackNarrationRequest) -> dict:
    return {
        "frontend": req.frontend.model_dump(),
        "backend": req.backend.model_dump(),
        "locale": req.locale,
    }


def _cache_key(req: StackNarrationRequest) -> str:
    raw = json.dumps(
        {
            "request": _request_payload(req),
            "model": settings.llm_model,
            "promptVersion": _PROMPT_VERSION,
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_prompt(req: StackNarrationRequest) -> str:
    return (
        _prompt_template()
        .replace("{STACK_JSON}", json.dumps(_request_payload(req), ensure_ascii=False, indent=2))
        .replace("{TECH_META_JSON}", json.dumps(_selected_meta(req), ensure_ascii=False, indent=2))
    )


def _main_item(req: StackNarrationRequest, role: str, items) -> str:
    found = next((it.name for it in items if it.role == role), None)
    return found or (items[0].name if items else "未知")


def _fallback(req: StackNarrationRequest) -> StackNarration:
    frontend = _main_item(req, "framework", req.frontend.items)
    frontend_lang = _main_item(req, "language", req.frontend.items)
    styling = _main_item(req, "styling", req.frontend.items)
    backend = _main_item(req, "framework", req.backend.items)
    backend_lang = _main_item(req, "language", req.backend.items)
    database = _main_item(req, "database", req.backend.items)
    title = f"{frontend} + {backend} + {database}"
    narrative = (
        f"{frontend}、{frontend_lang} 和 {styling} 让胶囊创建、广场筛选这类交互保持组件化、类型可追踪和令牌化样式约束；"
        f"{backend} 与 {backend_lang} 则把请求校验、OpenAPI 合同和异步处理显式放在接口边界上，"
        f"再交给 {database} 的事务模型承载刷新令牌、收藏计数和解锁时间等一致性要求。"
        "这组栈的教学重点不是各技术单点能力，而是观察 UI 状态、接口契约、迁移和数据约束如何互相校准；"
        "收益是边界清晰、替换后端容易，成本是类型、错误处理和数据演进都需要持续维护。"
    )
    return StackNarration(title=title, narrative=narrative, generatedBy="local-template")


def narrate_stack(req: StackNarrationRequest) -> StackNarration:
    key = _cache_key(req)
    cached = _CACHE.get(key)
    if cached:
        return cached.model_copy(update={"cached": True})

    try:
        generated = generate_structured_narration(_build_prompt(req))
        result = StackNarration(
            title=str(generated["title"]).strip(),
            narrative=str(generated["narrative"]).strip(),
            generatedBy=f"{settings.llm_provider}:{settings.llm_model}",
            cached=False,
        )
    except (KeyError, TypeError, ValueError, LlmClientError) as e:
        logger.warning("Stack narration LLM failed; using local fallback: %s", e)
        result = _fallback(req)

    _CACHE[key] = result
    return result
