"""ORM Base + 跨驱动类型别名。

SQLAlchemy 2.0 声明式 base。UUID / DateTime 的跨驱动差异由
`engine.py` 里 event listeners 和类型在此集中处理。
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """所有 ORM 模型继承于此。"""

    pass
