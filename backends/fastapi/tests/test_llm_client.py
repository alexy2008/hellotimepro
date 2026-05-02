from __future__ import annotations

import io
import json
from urllib.error import HTTPError


class _Response:
    def __init__(self, body: dict):
        self._body = json.dumps(body).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self) -> bytes:
        return self._body


def test_llm_client_falls_back_to_chat_completions(monkeypatch):
    from app.core.config import settings
    from app.services import llm_client

    monkeypatch.setattr(settings, "llm_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    monkeypatch.setattr(settings, "llm_base_url", "https://example.test/api/v3")
    monkeypatch.setattr(settings, "llm_model", "demo-model")

    calls: list[str] = []

    def fake_urlopen(req, timeout):
        calls.append(req.full_url)
        if req.full_url.endswith("/responses"):
            raise HTTPError(
                req.full_url,
                404,
                "Not Found",
                hdrs=None,
                fp=io.BytesIO(b""),
            )
        assert req.full_url.endswith("/chat/completions")
        return _Response(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"title": "组合解读", "narrative": "融合式说明"}
                            )
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(llm_client, "urlopen", fake_urlopen)

    result = llm_client.generate_structured_narration("prompt")

    assert calls == [
        "https://example.test/api/v3/responses",
        "https://example.test/api/v3/chat/completions",
    ]
    assert result == {"title": "组合解读", "narrative": "融合式说明"}
