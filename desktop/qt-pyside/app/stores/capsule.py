"""我创建的 + 我收藏的：分页/删除/收藏切换（= React stores/capsule.ts）。"""
from __future__ import annotations

from PySide6.QtCore import Property, QObject, Signal, Slot

from api_client import ApiClient
from worker import run_async
from stores.plaza import PlazaStore

_PAGE_SIZE = 15


class CapsuleStore(QObject):
    changed = Signal()
    # 收藏态变化广播：组件按 id 匹配后更新本地显示
    favoriteChanged = Signal(str, bool, int)

    def __init__(self, api: ApiClient, plaza: PlazaStore):
        super().__init__()
        self._api = api
        self._plaza = plaza
        self._mine: list = []
        self._mine_page = 1
        self._mine_total = 0
        self._mine_total_pages = 0
        self._mine_loading = False
        self._fav: list = []
        self._fav_page = 1
        self._fav_total = 0
        self._fav_total_pages = 0
        self._fav_loading = False
        self._mine_seq = 0
        self._fav_seq = 0

    # ---- 我创建的
    @Property("QVariant", notify=changed)
    def mineItems(self):
        return self._mine

    @Property(int, notify=changed)
    def minePage(self):
        return self._mine_page

    @Property(int, notify=changed)
    def mineTotal(self):
        return self._mine_total

    @Property(int, notify=changed)
    def mineTotalPages(self):
        return self._mine_total_pages

    @Property(bool, notify=changed)
    def mineLoading(self):
        return self._mine_loading

    # ---- 我收藏的
    @Property("QVariant", notify=changed)
    def favItems(self):
        return self._fav

    @Property(int, notify=changed)
    def favPage(self):
        return self._fav_page

    @Property(int, notify=changed)
    def favTotal(self):
        return self._fav_total

    @Property(int, notify=changed)
    def favTotalPages(self):
        return self._fav_total_pages

    @Property(bool, notify=changed)
    def favLoading(self):
        return self._fav_loading

    @Slot(int)
    def fetchMine(self, page: int = 1):
        self._mine_page = page or self._mine_page
        self._mine_seq += 1
        my = self._mine_seq
        self._mine_loading = True
        self.changed.emit()

        def ok(data):
            if my != self._mine_seq:
                return
            self._mine = data.get("items", [])
            pg = data.get("pagination", {})
            self._mine_total = pg.get("total", 0)
            self._mine_total_pages = pg.get("totalPages", 0)
            self._mine_loading = False
            self.changed.emit()

        def err(_):
            if my != self._mine_seq:
                return
            self._mine_loading = False
            self.changed.emit()

        run_async(self._api.my_capsules, ok, err, self._mine_page, _PAGE_SIZE)

    @Slot(int)
    def fetchFavorites(self, page: int = 1):
        self._fav_page = page or self._fav_page
        self._fav_seq += 1
        my = self._fav_seq
        self._fav_loading = True
        self.changed.emit()

        def ok(data):
            if my != self._fav_seq:
                return
            self._fav = data.get("items", [])
            pg = data.get("pagination", {})
            self._fav_total = pg.get("total", 0)
            self._fav_total_pages = pg.get("totalPages", 0)
            self._fav_loading = False
            self.changed.emit()

        def err(_):
            if my != self._fav_seq:
                return
            self._fav_loading = False
            self.changed.emit()

        run_async(self._api.my_favorites, ok, err, self._fav_page, _PAGE_SIZE)

    @Slot(str)
    def deleteCapsule(self, capsule_id: str):
        def ok(_):
            self._mine = [c for c in self._mine if c.get("id") != capsule_id]
            self.changed.emit()
        run_async(self._api.delete_my_capsule, ok, None, capsule_id)

    @Slot(str, bool)
    def toggleFavorite(self, capsule_id: str, favorited_by_me: bool):
        if favorited_by_me:
            def ok(_):
                self._fav = [c for c in self._fav if c.get("id") != capsule_id]
                cur = next((i for i in self._plaza.items if i.get("id") == capsule_id), None)
                new_count = max(0, (cur.get("favoriteCount", 1) if cur else 1) - 1)
                self._plaza.patchFavorited(capsule_id, False, new_count)
                self.favoriteChanged.emit(capsule_id, False, new_count)
                self.changed.emit()
            run_async(self._api.unfavorite, ok, None, capsule_id)
        else:
            def ok(result):
                count = result.get("favoriteCount", 0)
                self._plaza.patchFavorited(capsule_id, True, count)
                self.favoriteChanged.emit(capsule_id, True, count)
            run_async(self._api.favorite, ok, None, capsule_id)
