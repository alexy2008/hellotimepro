// ============================================================
// 极简可观察 store —— 原生小程序没有 React/zustand，这里手搓一个
// 与 zustand vanilla API 同形的最小实现（getState / setState / subscribe），
// 让从 frontends/react-ts 移植来的 store 逻辑几乎逐字保留。
//
// 用法（页面侧）：
//   const unsub = usePlaza.subscribe((s) => this.setData({ items: s.items }));
//   在 onUnload 里调用 unsub()。
// connect() 是常见「订阅 + 首屏推数」的糖。
// ============================================================

function create(factory) {
  let state;
  const listeners = new Set();

  const set = (partial) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    state = Object.assign({}, state, next);
    listeners.forEach((l) => l(state));
  };
  const get = () => state;

  state = factory(set, get);

  const useStore = () => state;
  useStore.getState = get;
  useStore.setState = set;
  useStore.subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return useStore;
}

/**
 * 把 store 订阅接到页面/组件：立即用 selector 推一次首屏，之后每次变更再推。
 * 返回取消订阅函数，务必在 onUnload / detached 调用。
 *
 * @param {object} ctx      Page / Component 实例（提供 setData）
 * @param {Function} store  create() 产物
 * @param {Function} selector (state) => 要 setData 的数据对象
 */
function connect(ctx, store, selector) {
  const push = (s) => ctx.setData(selector(s));
  push(store.getState());
  return store.subscribe(push);
}

module.exports = { create, connect };
