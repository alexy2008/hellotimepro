"""OpenAI-compatible LLM client used by stack narration."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings


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
    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=settings.llm_timeout_ms / 1000) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        detail = body.strip() or str(e)
        raise LlmClientError(f"HTTP {e.code}: {detail[:500]}", status=e.code) from e
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as e:
        raise LlmClientError(str(e)) from e


def _generate_with_responses(prompt: str) -> dict:
    body = _post_json(
        _responses_url(),
        {
            "model": settings.llm_model,
            "input": prompt,
            "max_output_tokens": 600,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "stack_narration",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["title", "narrative"],
                        "properties": {
                            "title": {"type": "string"},
                            "narrative": {"type": "string"},
                        },
                    },
                }
            },
        },
    )
    try:
        return _parse_json_object(_extract_text(body))
    except json.JSONDecodeError as e:
        raise LlmClientError("LLM output was not valid JSON") from e


def _chat_payload(prompt: str, *, disable_thinking: bool) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
                    "JSON 必须包含字符串字段 title 和 narrative。"
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 600,
    }
    if disable_thinking:
        payload["thinking"] = {"type": "disabled"}
    return payload


def _generate_with_chat_completions(prompt: str) -> dict:
    try:
        body = _post_json(_chat_completions_url(), _chat_payload(prompt, disable_thinking=True))
    except LlmClientError as e:
        if e.status != 400:
            raise
        body = _post_json(_chat_completions_url(), _chat_payload(prompt, disable_thinking=False))

    try:
        return _parse_json_object(_extract_chat_text(body))
    except json.JSONDecodeError as e:
        raise LlmClientError("LLM chat output was not valid JSON") from e


def generate_structured_narration(prompt: str) -> dict:
    if not settings.llm_enabled or not settings.llm_api_key.strip():
        raise LlmClientError("LLM is disabled or missing API key")

    try:
        return _generate_with_responses(prompt)
    except LlmClientError as e:
        if e.status not in {400, 404, 405}:
            raise

    return _generate_with_chat_completions(prompt)
