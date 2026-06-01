"""OpenAI-compatible LLM client used by capsule suggestions."""

from __future__ import annotations

import json
import logging
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

logger = logging.getLogger(__name__)


class LlmClientError(RuntimeError):
    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def _responses_url() -> str:
    return settings.llm_base_url.rstrip("/") + "/responses"


def _chat_completions_url() -> str:
    return settings.llm_base_url.rstrip("/") + "/chat/completions"


def _extract_text(body: dict) -> str:
    output_text = body.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    for item in body.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                return content["text"]
    raise LlmClientError("LLM response did not contain output text")


def _extract_chat_text(body: dict) -> str:
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise LlmClientError("LLM chat response did not contain choices")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if isinstance(content, str) and content.strip():
        return content
    raise LlmClientError("LLM chat response did not contain message content")


def _parse_json_object(text: str) -> dict:
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.strip("`").strip()
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        parsed = json.loads(raw[start : end + 1])
    if not isinstance(parsed, dict):
        raise LlmClientError("LLM output JSON was not an object")
    return parsed


def _post_json(url: str, payload: dict[str, Any]) -> dict:
    payload = {k: v for k, v in payload.items() if v is not None}
    model = payload.get("model", settings.llm_model)
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        # 避免被网关的机器人防护按默认 urllib UA 封禁（Cloudflare error 1010）
        "User-Agent": settings.llm_user_agent,
    }
    attempts = max(1, settings.llm_max_retries + 1)
    for attempt in range(1, attempts + 1):
        logger.info("LLM request  model=%s url=%s attempt=%d/%d", model, url, attempt, attempts)
        t0 = time.monotonic()
        try:
            req = Request(url, data=data, headers=headers, method="POST")
            with urlopen(req, timeout=settings.llm_timeout_ms / 1000) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            # 尝试读取服务端返回的 token 用量（OpenAI 格式）
            usage = body.get("usage") or {}
            tokens = usage.get("total_tokens") or (
                (usage.get("input_tokens") or 0) + (usage.get("output_tokens") or 0)
            )
            logger.info(
                "LLM response model=%s elapsed_ms=%d tokens=%s",
                model, elapsed_ms, tokens if tokens else "n/a",
            )
            return body
        except HTTPError as e:
            # 服务端给了明确响应（含 Cloudflare 1010）——非瞬时错误，不重试
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            body_text = e.read().decode("utf-8", errors="replace")
            detail = body_text.strip() or str(e)
            logger.warning(
                "LLM error    model=%s elapsed_ms=%d status=%d detail=%s",
                model, elapsed_ms, e.code, detail[:200],
            )
            raise LlmClientError(f"HTTP {e.code}: {detail[:500]}", status=e.code) from e
        except json.JSONDecodeError as e:
            # 拿到了响应但不是合法 JSON——重试通常也无济于事，直接失败
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            logger.warning(
                "LLM error    model=%s elapsed_ms=%d error=invalid-json:%s",
                model, elapsed_ms, e,
            )
            raise LlmClientError(str(e)) from e
        except (URLError, TimeoutError, OSError) as e:
            # 瞬时网络/TLS 错误（如 SSL UNEXPECTED_EOF、连接被掐断）——在剩余次数内重试
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            will_retry = attempt < attempts
            logger.warning(
                "LLM error    model=%s elapsed_ms=%d error=%s%s",
                model, elapsed_ms, e, " (will retry)" if will_retry else "",
            )
            if not will_retry:
                raise LlmClientError(str(e)) from e
            time.sleep(settings.llm_retry_backoff_ms / 1000 * attempt)
    # 循环必然 return 或 raise；此处仅为类型完整性
    raise LlmClientError("LLM request exhausted retries")


_CAPSULE_SUGGESTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["title", "content", "openInDays"],
    "properties": {
        # title 始终出现在 schema 中（strict 模式要求 required 覆盖全部 properties）；
        # 当请求已带标题时，服务层会忽略该字段。
        "title": {"type": "string"},
        "content": {"type": "string"},
        "openInDays": {"type": "integer", "minimum": 1, "maximum": 3650},
    },
}
_CAPSULE_SUGGESTION_SYSTEM = (
    "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
    "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。"
    "若用户已给出标题，title 可原样回填。"
)

_CAPSULE_RECOMMENDATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["items"],
    "properties": {
        "items": {
            "type": "array",
            "minItems": 3,
            "maxItems": 8,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["title", "hint", "openInDays"],
                "properties": {
                    "title": {"type": "string"},
                    "hint": {"type": "string"},
                    "openInDays": {"type": "integer", "minimum": 1, "maximum": 3650},
                },
            },
        }
    },
}
_CAPSULE_RECOMMENDATION_SYSTEM = (
    "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
    "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。"
)


def _generate_with_responses(
    prompt: str, *, schema_name: str, schema: dict, max_output_tokens: int
) -> dict:
    body = _post_json(
        _responses_url(),
        {
            "model": settings.llm_model,
            "input": prompt,
            "max_output_tokens": max_output_tokens,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
        },
    )
    try:
        return _parse_json_object(_extract_text(body))
    except json.JSONDecodeError as e:
        raise LlmClientError("LLM output was not valid JSON") from e


def _chat_payload(prompt: str, *, system: str, max_tokens: int) -> dict[str, Any]:
    # 本应用的生成任务（标题/正文/推荐）不需要推理，固定关闭 thinking 以提速。
    return {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "thinking": {"type": "disabled"},
    }


def _generate_with_chat_completions(
    prompt: str, *, system: str, max_tokens: int
) -> dict:
    body = _post_json(
        _chat_completions_url(),
        _chat_payload(prompt, system=system, max_tokens=max_tokens),
    )
    try:
        return _parse_json_object(_extract_chat_text(body))
    except json.JSONDecodeError as e:
        raise LlmClientError("LLM chat output was not valid JSON") from e


def _generate_structured_json(
    prompt: str,
    *,
    schema_name: str,
    schema: dict,
    system: str,
    max_tokens: int = 600,
) -> dict:
    if not settings.llm_enabled or not settings.llm_api_key.strip():
        logger.debug("LLM skip     schema=%s reason=disabled_or_no_key", schema_name)
        raise LlmClientError("LLM is disabled or missing API key")

    style = settings.llm_api_style
    if style == "responses":
        return _generate_with_responses(
            prompt, schema_name=schema_name, schema=schema, max_output_tokens=max_tokens
        )
    if style == "auto":
        # 先试 Responses API；任何失败（404、TLS EOF、超时等）回退到 Chat Completions。
        try:
            return _generate_with_responses(
                prompt, schema_name=schema_name, schema=schema, max_output_tokens=max_tokens
            )
        except LlmClientError as e:
            logger.info("Responses API unavailable (%s); falling back to chat completions", e)
        return _generate_with_chat_completions(prompt, system=system, max_tokens=max_tokens)

    # 默认 "chat"：直接走 Chat Completions，跳过本网关不支持的 /responses（省一次请求、避免在死端点上挂超时）。
    return _generate_with_chat_completions(prompt, system=system, max_tokens=max_tokens)


def generate_capsule_suggestion(prompt: str) -> dict:
    return _generate_structured_json(
        prompt,
        schema_name="capsule_suggestion",
        schema=_CAPSULE_SUGGESTION_SCHEMA,
        system=_CAPSULE_SUGGESTION_SYSTEM,
        max_tokens=900,
    )


def generate_capsule_recommendations(prompt: str) -> dict:
    return _generate_structured_json(
        prompt,
        schema_name="capsule_recommendations",
        schema=_CAPSULE_RECOMMENDATION_SCHEMA,
        system=_CAPSULE_RECOMMENDATION_SYSTEM,
        max_tokens=900,
    )
