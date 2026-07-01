"""广场 store：sort/filter/q + 分页 + 列表（= React stores/plaza.ts）。fetch 用序列号防乱序。"""
from __future__ import annotations

from PySide6.QtCore import Property, QObject, Signal, Slot

from api_client import ApiClient
from worker import run_async


class PlazaStore(QObject):
    changed = Signal()

    def __init__(self, api: ApiClient):
        super().__init__()
        self._api = api
        self._sort = "new"
        self._filter = "all"
        self._q = ""
        self._page = 1
        self._page_size = 15
        self._items: list = []
        self._total = 0
        self._total_pages = 0
        self._loading = False
        self._seq = 0

    @Property("QVariant", notify=changed)
    def items(self):
        return self._items

    @Property(str, notify=changed)
    def sort(self):
        return self._sort

    @Property(str, notify=changed)
    def filter(self):
        return self._filter

    @Property(int, notify=changed)
    def page(self):
        return self._page

    @Property(int, notify=changed)
    def total(self):
        return self._total

    @Property(int, notify=changed)
    def totalPages(self):
        return self._total_pages

    @Property(bool, notify=changed)
    def loading(self):
        return self._loading

    @Slot(str)
    def setSort(self, s: str):
        self._sort = s
        self._page = 1
        self.changed.emit()
        self.fetch()

    @Slot(str)
    def setFilter(self, f: str):
        self._filter = f
        self._page = 1
        self.changed.emit()
        self.fetch()

    @Slot(str)
    def setQ(self, q: str):
        self._q = q
        self._page = 1
        self.changed.emit()
        self.fetch()

    @Slot(int)
    def setPage(self, p: int):
        self._page = p
        self.changed.emit()
        self.fetch()

    @Slot()
    def fetch(self):
        self._seq += 1
        my = self._seq
        self._loading = True
        self.changed.emit()

        def ok(data):
            if my != self._seq:
                return
            self._items = data.get("items", [])
            pg = data.get("pagination", {})
            self._total = pg.get("total", 0)
            self._total_pages = pg.get("totalPages", 0)
            self._loading = False
            self.changed.emit()

        def err(_):
            if my != self._seq:
                return
            self._loading = False
            self.changed.emit()

        run_async(
            self._api.plaza, ok, err,
            self._sort, self._filter, self._q.strip() or None, self._page, self._page_size,
        )

    def patchFavorited(self, capsule_id: str, favorited: bool, count: int):
        changed = False
        new_items = []
        for it in self._items:
            if it.get("id") == capsule_id:
                it = {**it, "favoritedByMe": favorited, "favoriteCount": count}
                changed = True
            new_items.append(it)
        if changed:
            self._items = new_items
            self.changed.emit()
