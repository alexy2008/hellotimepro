"""头像目录 —— 直接读 spec/avatars/catalog.json，内存缓存。"""

from __future__ import annotations

import json
from functools import lru_cache

from app.core.config import settings
from app.schemas.avatar import Avatar


@lru_cache(maxsize=1)
def load_avatars() -> list[Avatar]:
    raw = json.loads(settings.avatars_catalog_path.read_text(encoding="utf-8"))
    items = raw.get("avatars", [])
    return [
        Avatar(
            id=a["id"],
            name=a["name"],
            primaryColor=a["primaryColor"],
            svgUrl=f"/static/avatars/{a['id']}.svg",
        )
        for a in items
    ]


def allowed_avatar_ids() -> set[str]:
    return {a.id for a in load_avatars()}
