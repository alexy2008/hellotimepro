// ============================================================
// 胶囊状态：我创建的 + 我收藏的（分页 / 删除 / 收藏切换）。
// 逐字移植自 mobile/react-native/src/stores/capsule.ts（纯逻辑，TS→JS 零改动）。
// ============================================================

const { create } = require("../utils/store");
const { api } = require("../utils/api");
const { usePlaza } = require("./plaza");

const PAGE_SIZE = 15;

const emptySlice = () => ({
  items: [],
  pagination: null,
  page: 1,
  loading: false,
  error: null,
});

// 序列号：避免并发请求乱序覆盖结果
let mineSeq = 0;
let favSeq = 0;

const useCapsule = create((set, get) => ({
  mine: emptySlice(),
  favorites: emptySlice(),

  fetchMine: async (page) => {
    const p = page != null ? page : get().mine.page;
    const myId = ++mineSeq;
    set((s) => ({ mine: { ...s.mine, page: p, loading: true, error: null } }));
    try {
      const data = await api.myCapsules(p, PAGE_SIZE);
      if (myId !== mineSeq) return;
      set((s) => ({
        mine: {
          ...s.mine,
          items: data.items,
          pagination: data.pagination,
          loading: false,
        },
      }));
    } catch (e) {
      if (myId !== mineSeq) return;
      set((s) => ({
        mine: {
          ...s.mine,
          loading: false,
          error: e instanceof Error ? e.message : "加载失败",
        },
      }));
    }
  },

  fetchFavorites: async (page) => {
    const p = page != null ? page : get().favorites.page;
    const myId = ++favSeq;
    set((s) => ({
      favorites: { ...s.favorites, page: p, loading: true, error: null },
    }));
    try {
      const data = await api.myFavorites(p, PAGE_SIZE);
      if (myId !== favSeq) return;
      set((s) => ({
        favorites: {
          ...s.favorites,
          items: data.items,
          pagination: data.pagination,
          loading: false,
        },
      }));
    } catch (e) {
      if (myId !== favSeq) return;
      set((s) => ({
        favorites: {
          ...s.favorites,
          loading: false,
          error: e instanceof Error ? e.message : "加载失败",
        },
      }));
    }
  },

  deleteCapsule: async (id) => {
    await api.deleteMyCapsule(id);
    set((s) => ({
      mine: { ...s.mine, items: s.mine.items.filter((c) => c.id !== id) },
    }));
  },

  toggleFavorite: async (capsuleId, favoritedByMe) => {
    if (favoritedByMe) {
      await api.unfavorite(capsuleId);
      set((s) => ({
        favorites: {
          ...s.favorites,
          items: s.favorites.items.filter((c) => c.id !== capsuleId),
        },
      }));
      const plazaItem = usePlaza.getState().items.find((i) => i.id === capsuleId);
      const newCount = Math.max(0, (plazaItem ? plazaItem.favoriteCount : 1) - 1);
      usePlaza.getState().patchFavorited(capsuleId, false, newCount);
      return { favoriteCount: newCount };
    } else {
      const result = await api.favorite(capsuleId);
      usePlaza.getState().patchFavorited(capsuleId, true, result.favoriteCount);
      return { favoriteCount: result.favoriteCount };
    }
  },

  reset: () => {
    mineSeq++;
    favSeq++;
    set({ mine: emptySlice(), favorites: emptySlice() });
  },
}));

module.exports = { useCapsule };
