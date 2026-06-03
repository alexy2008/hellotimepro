# HelloTime Pro · SolidJS 前端技术手册与代码导读

面向**已经会 React / Vue，第一次读 SolidJS** 的读者。本项目与 `frontends/react-ts`
功能完全一致、共享同一份 API 契约与设计令牌，因此最适合把它当作「同一个产品的 SolidJS 译本」来读：
逻辑层逐字复用，UI 层是 SolidJS 习惯写法的重写。读完你会建立两个核心直觉：

1. **SolidJS 的组件函数只运行一次**——这与 React「每次渲染重跑函数」是根本性的区别。
2. **响应式是细粒度的**——状态读取在哪里发生，更新就只刷新那一处 DOM，没有虚拟 DOM、没有 diff。

---

## 1. 技术选型与设计特色

| 维度 | 选择 | 说明 |
|---|---|---|
| 框架 | SolidJS 1.9 | 细粒度响应式 + 编译期优化，无虚拟 DOM |
| 语言 | TypeScript 5.7 | 与后端 OpenAPI 契约对齐 |
| 构建 | Vite 6 + `vite-plugin-solid` | babel-preset-solid 把 JSX 编译为真实 DOM 操作 |
| 路由 | `@solidjs/router` 0.16 | `<Router>` / `<Route>` / `<A>` / `useNavigate` / `useParams` |
| 状态 | 模块级 `createSignal` / `createStore` | 全局状态脱离组件树，类似 react-ts 里 Zustand 的角色 |
| 样式 | Tailwind v4 + `spec/styles` 设计令牌 | 与所有前端共享 `cy-*` 组件类 |

**一句话定位**：React 用「重跑函数 + 虚拟 DOM diff」实现声明式 UI；SolidJS 用「函数跑一次 + 细粒度订阅」
实现同样的声明式 UI。心智从「什么时候组件会重渲染」变成「这块响应式数据被谁订阅了」。

---

## 2. 整体地图

```
src/
├── main.tsx            挂载入口：render(() => <App/>, #root)
├── App.tsx             <Router> 路由表 + 启动时 hydrate
├── api/client.ts       fetch 封装 / 响应解包 / 自动 refresh        ← 与 react-ts 逐字一致
├── types/index.ts      契约类型 + ApiError                         ← 与 react-ts 逐字一致
├── utils/{avatar,format}.ts  头像 URL / 倒计时 / 时间格式           ← 与 react-ts 逐字一致
├── stores/             全局响应式状态（SolidJS 习惯写法，本译本重写）
│   ├── theme.ts        createSignal
│   ├── auth.ts         createStore + configureApi 注入
│   ├── plaza.ts        createStore
│   └── capsule.ts      createStore
├── components/         15 个展示 / 容器组件
├── pages/              11 个路由页面
└── styles/             index.css（令牌 import）+ layout.css（布局类）
```

可复用的「纯 TS」（`api` / `types` / `utils`）在所有前端之间是一字不差的——这正是契约驱动多栈项目的价值：
**业务逻辑与框架无关，框架只负责把状态渲染成 DOM。** 真正体现 SolidJS 特色的是 `stores/`、`components/`、`pages/`。

---

## 3. 如何运行和验证

```bash
# 后端 + 反代
./scripts/hello start fastapi && ./scripts/hello switch fastapi

# 前端（端口 7180）
./scripts/hello start solid          # 或 cd frontends/solid && ./run

# 验证（25 个 Playwright 冒烟用例）
./verification/scripts/verify-ui-smoke.sh solid

# 类型检查 / 单测 / 构建
cd frontends/solid
npm run lint      # tsc --noEmit
npm test          # vitest（api client + format 纯函数）
./build           # tsc + vite build
```

---

## 4. 入口链路：`index.html` → `main.tsx` → `App.tsx`

### 4.1 `index.html`
SPA 唯一的 HTML，只有一个 `<div id="root">` 和一段提早注入 `data-theme` 的内联脚本（避免首屏闪白）。

### 4.2 `main.tsx`
```tsx
import { render } from "solid-js/web";
render(() => <App />, document.getElementById("root")!);
```
注意 `render` 的第一个参数是**函数**（`() => <App/>`），不是 React 的 `<App/>` 元素。
SolidJS 需要在一个「响应式 root」里执行组件树，这个函数就是 root 的入口。

### 4.3 `App.tsx`
根组件做三件事：启动时 hydrate、登录态自动校验、声明路由表。

```tsx
export function App() {
  onMount(() => {        // 挂载后执行一次（仅客户端）
    hydrateTheme();
    hydrateAuth();
  });

  createEffect(() => {   // 依赖变化时自动重跑
    if (auth.hydrated && auth.refreshToken) void refreshMe();
  });

  return (
    <Router>
      <Route component={MainLayout}>
        <Route path="/" component={PlazaPage} />
        {/* … */}
      </Route>
      <Route component={MeShell}>{/* 受保护的个人中心 */}</Route>
      <Route path="*" component={NotFoundPage} />
    </Router>
  );
}
```

`createEffect` 自动追踪函数体内读取的响应式数据（这里是 `auth.hydrated`、`auth.refreshToken`），
当它们变化时重跑——**没有 React 那样的依赖数组**，依赖是自动收集的。

---

## 5. SolidJS 核心概念：细粒度响应式

### 5.1 `createSignal`：最小响应式单元
```tsx
const [count, setCount] = createSignal(0);
count();        // 读：在响应式上下文里读会建立订阅
setCount(1);    // 写：通知所有订阅者
setCount(c => c + 1);  // 函数式更新
```
关键区别：**`count` 是一个 getter 函数，读值要调用 `count()`**。这不是啰嗦，而是 SolidJS 追踪订阅的机制——
只有「在响应式上下文里调用 getter」才会被记录为依赖。

本项目 `stores/theme.ts` 就是一个最小例子：模块顶层 `createSignal`，导出 getter，组件里 `theme() === "dark"`。

### 5.2 `createStore`：嵌套对象的细粒度响应
当状态是一个对象（尤其有嵌套）时用 `createStore`，它返回一个 proxy，**读属性路径就建立细粒度订阅**：
```tsx
const [auth, setAuth] = createStore({ user: null, accessToken: null, hydrated: false });
auth.user;                        // 读：只订阅 user 字段
setAuth({ user: me });            // 合并顶层字段
setAuth("mine", "items", arr);    // 按路径精确更新嵌套字段
```
`stores/{auth,plaza,capsule}.ts` 都用 `createStore`。例如 `capsule.ts` 持有 `{ mine, favorites }` 两个分片，
`setCapsule("mine", { loading: true })` 只更新 `mine` 分片，订阅 `capsule.favorites` 的组件不会被触动。

### 5.3 `createEffect` / `onMount` / `onCleanup`
```tsx
createEffect(() => {           // 自动追踪依赖，依赖变化重跑
  if (opened()) return;
  const t = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(t));   // 重跑前 / 卸载时清理
});
onMount(() => { /* 挂载后跑一次，不追踪依赖 */ });
```
对照 React：`onMount` ≈ `useEffect(fn, [])`；`createEffect` ≈ `useEffect` 但**依赖自动收集**；
`onCleanup` ≈ effect 返回的清理函数。`CapsuleCard` / `CapsuleDetail` 的每秒倒计时就是这个模式。

### 5.4 派生值：函数即 memo
SolidJS 里「派生状态」通常就是一个普通函数：
```tsx
const cd = () => countdownTo(props.capsule.openAt, now());   // 读 cd() 时才计算
```
需要缓存昂贵计算时才用 `createMemo`。本项目大多数派生直接用箭头函数 getter（如 `contentLen()`、`dotClass()`）。

### 5.5 props 不要解构
```tsx
// ✓ 正确：保持响应性
function Card(props: { capsule: CapsuleListItem }) {
  return <h3>{props.capsule.title}</h3>;
}
// ✗ 错误：解构会读出当时的快照，丢失后续更新
function Card({ capsule }) { /* capsule 不再响应 */ }
```
这是 React 老手最容易踩的坑。本项目所有组件都通过 `props.x` 访问。需要默认值时用 `() => props.x ?? 默认`
（见 `CapsuleCard` 的 `showCreator`、`Alert` 的 `variant`）。

### 5.6 控制流：`<Show>` / `<For>` / `<Index>`
```tsx
<Show when={auth.user} fallback={<LoginButtons/>}>
  {(user) => <Chip name={user().nickname} />}   {/* user() 是非空 Accessor */}
</Show>

<For each={plaza.items}>{(c) => <CapsuleCard capsule={c} />}</For>   {/* 按引用 keyed */}
<Index each={chars()}>{(ch, i) => <input value={ch()} />}</Index>   {/* 按位置 keyed */}
```
- `<Show>` 的 callback 形式能把 `when` 收窄为非空 Accessor，省去 `!` 断言。
- `<For>` 按**元素引用**协调，适合可增删的列表（广场、收藏）。
- `<Index>` 按**位置**协调，item 是 Accessor、index 是数字，适合定长且按位更新——`CapsuleCodeInput` 的 8 个格子用它最贴切。

### 5.7 ⚠️ 陷阱：`createEffect` 会追踪到你「顺手读到」的依赖

这是 React 老手移植到 Solid 时最隐蔽的坑，也是本项目实测踩到过的。`createEffect` 的依赖不是手写的，
而是**自动收集 effect 同步执行期间读取过的所有响应式数据**——包括 effect 里调用的函数内部的同步读取。

反面例子（曾经的写法）：

```tsx
// PlazaPage：本意是「hydrate 完加载一次广场」
createEffect(() => {
  if (auth.hydrated) void fetchPlaza();   // ← 看起来只依赖 auth.hydrated
});

// 但 fetchPlaza 同步读取了一堆 store 字段来拼请求参数：
async function fetchPlaza() {
  setPlaza({ loading: true });
  const data = await api.plaza({
    sort: plaza.sort, filter: plaza.filter, q: plaza.q,   // ← 这些读取发生在 await 之前，
    page: plaza.page, pageSize: plaza.pageSize,           //    仍在 effect 的同步追踪窗口内！
  });
  /* … await 之后的读取不再被追踪 … */
}
```

结果：这个 effect 实际依赖 `{ auth.hydrated, plaza.sort, plaza.filter, plaza.q, plaza.page, plaza.pageSize }`。
而 `setSort/setFilter/setQ/setPage` 本身已经会调一次 `fetchPlaza()`，于是每次筛选/搜索/翻页都**请求两次**
（序列号守卫会丢弃过期那次，所以结果正确，但白白多打一次网络）。

> 对比 React：`useEffect(fn, [hydrated, fetchPlaza])` 的依赖是手写死的，改 `plaza.sort` 不会重跑这个 effect——
> 所以 React 版**天然没有**这个问题。这正是「自动依赖收集」的双刃剑。

两种修法：

```tsx
// 法一：untrack 把不想追踪的读取圈起来（本项目采用）
createEffect(() => {
  if (auth.hydrated) untrack(() => void fetchPlaza());  // effect 只订阅 auth.hydrated
});

// 法二：只在 effect 里读「真正的触发条件」，副作用调用挪到不追踪的地方
```

同源的判断也用在 `App.tsx` 的 `refreshMe` effect：条件写成 `auth.hydrated && auth.refreshToken && !auth.user`，
并用 `untrack` 包住调用，避免登录 `setTokens` / token 轮换改动 `refreshToken` 时重复拉 `/me`。

**经验法则**：当 effect 体里调用的函数会同步读取响应式数据、而你又不希望它们成为依赖时，用 `untrack` 圈住调用。

---

## 6. 路由层：`@solidjs/router`

嵌套路由通过「父 `<Route>` 的 `component` 接收 `props.children`」实现 outlet：

```tsx
<Route component={MainLayout}>          {/* MainLayout 渲染 props.children */}
  <Route path="/" component={PlazaPage} />
</Route>
```

`MainLayout` / `MeLayout` 因此都接收 `props: { children?: JSX.Element }` 并在合适位置渲染 `{props.children}`。

导航 API：
- `<A href="/open" activeClass="cy-nav__active" end>` —— 声明式链接，`activeClass` 自动加在当前路由，`end` 表示精确匹配（首页 `/` 必须加，否则会匹配所有路径）。
- `useNavigate()` —— 命令式跳转：`navigate("/me/created", { replace: true })`、`navigate(-1)`。
- `useParams<{code:string}>()` —— 读路径参数（`CapsuleByCodePage` 用 `params.code`，且它是响应式的，`createEffect` 里读它即可在换 code 时自动重载）。
- `useLocation().state` —— 读上次导航携带的 state（`AuthGate` 写 `from`，`LoginPage` 据此回跳）。

---

## 7. 布局与守卫

### `MainLayout` / `MeLayout`
共享外壳（Header / Footer），通过 `props.children` 放置子路由内容。`MeLayout` 还多一个侧边导航。

### `AuthGate`
路由守卫用声明式 `<Show>` 表达，而不是命令式跳转：
```tsx
export function AuthGate(props: { children: JSX.Element }) {
  const location = useLocation();
  return (
    <Show when={auth.hydrated} fallback={null}>
      <Show when={auth.user || auth.refreshToken}
            fallback={<Navigate href="/login" state={{ from: location.pathname }} />}>
        {props.children}
      </Show>
    </Show>
  );
}
```
两层 `<Show>`：先等 hydrate 完成（避免刷新页瞬间误判未登录），再判断登录态。
受保护页面在 `App.tsx` 里被包进 `AuthGate`（`/create` 直接包，`/me/*` 通过 `MeShell` 包 `MeLayout`）。

---

## 8. 数据层：`api/client.ts`（与 react-ts 一致）

这一层是纯 TS，没有任何框架味道，所以跨前端逐字复用。要点：

- 统一 `request<T>(path, opts)`：拼 URL、带 `Authorization`、解响应包装 `{success,data,...}`，失败抛 `ApiError`。
- **自动 refresh**：命中 `401 + UNAUTHORIZED` 时调 `/auth/refresh` 拿新 access token 后重放原请求；
  并发请求共享同一个 `refreshing` Promise 去重——多个请求同时 401 只会触发一次 refresh，其余等待同一 Promise。
- **与 store 解耦（依赖倒置）**：client **不** import 任何 store，而是暴露一个 `configureApi(cbs)` 注册函数：

```tsx
// api/client.ts —— 只持有回调，不知道 store 长什么样
let cbs: ApiCallbacks = { getAccessToken: () => null, /* … */ };
export function configureApi(c: Partial<ApiCallbacks>) { cbs = { ...cbs, ...c }; }

// stores/auth.ts —— 模块加载时把「读 token / 写回新 token / 登录失效」的能力注入进去
configureApi({
  getAccessToken:   () => auth.accessToken,
  getRefreshToken:  () => auth.refreshToken,
  onTokensRefreshed: (a, r) => patchTokens(a, r),  // refresh 成功后写回 store
  onAuthLost:        () => logout(),               // refresh 也失败 → 清空登录态
});
```

这样的好处：①`client.ts` 跨 5 个前端逐字复用，因为它不依赖任何框架的状态方案；
②打破了「client 要读 token → 依赖 auth store → auth store 要用 client 发请求」的循环依赖；
③测试 client 时可注入假回调（见 §15）。

---

## 9. 状态层：模块级 Signal / Store

SolidJS 的响应式不依赖组件树，因此「全局 store」就是**模块顶层的 Signal / Store + 导出动作函数**，
角色等同 react-ts 里的 Zustand，但更轻——没有 `create()`、没有 selector、没有 Provider。

```tsx
// stores/auth.ts（节选）
const [auth, setAuth] = createStore<AuthStore>({ user: null, /* … */ hydrated: false });
export { auth };
export function setTokens(t: AuthTokens) { setAuth({ user: t.user, /* … */ }); persist(/* … */); }
// 启动时把读 token 的能力注入 api client
configureApi({ getAccessToken: () => auth.accessToken, /* … */ });
```

组件里直接 `import { auth, logout } from "@/stores/auth"`，读 `auth.user` 建立订阅，调 `logout()` 触发更新。

四个 store：
- `theme.ts` — `createSignal` 主题，配 `hydrateTheme/toggleTheme`。
- `auth.ts` — `createStore` 鉴权，配 hydrate/setTokens/patchTokens/logout/refreshMe，并注入 `configureApi`。
- `plaza.ts` — `createStore` 广场（sort/filter/q/page），动作触发 `fetchPlaza()`。
- `capsule.ts` — `createStore` 我创建的 / 我收藏的两个分片，跨 store 联动时调用 `plaza` 的 `patchPlazaFavorited`。

### 9.1 `createSignal` 还是 `createStore`？

| 用 `createSignal` | 用 `createStore` |
|---|---|
| 单个标量值（主题字符串、loading 布尔、表单字段） | 含多个字段、尤其是嵌套对象 / 数组的状态 |
| `theme.ts` | `auth` / `plaza` / `capsule` |
| 读写整体替换 | 想按字段路径精确更新、精确订阅 |

`createStore` 的核心价值是**路径更新 + 路径订阅**，二者一一对应：

```tsx
// 顶层合并（只动 loading/error，items 引用不变 → 订阅 items 的 <For> 不重渲染）
setPlaza({ loading: true, error: null });

// 路径定位到嵌套分片
setCapsule("mine", { loading: true });

// 路径 + 函数式更新数组（不可变 map）
setCapsule("mine", "items", (items) => items.filter((c) => c.id !== id));
setPlaza("items", (items) => items.map((it) => it.id === id ? { ...it, favoritedByMe } : it));
```

`capsule.ts` 把状态切成 `{ mine, favorites }` 两个 `ListSlice`，正因为 `createStore` 能让
「只更新 `mine` 分片」与「只订阅 `favorites` 分片的页面」互不打扰——这是 `createSignal` 做不到的细粒度。

### 9.2 并发请求的「序列号」模式（完整版）

列表类 store 都面临同一个竞态：用户快速切 sort / 翻页，先发的请求可能后到，**旧响应覆盖新结果**。
解法是给每次请求编号，回写前校验自己仍是「最新发起」：

```tsx
// plaza.ts —— 闭包变量，不放进 store（它不需要被订阅）
let fetchSeq = 0;

export async function fetchPlaza() {
  const myId = ++fetchSeq;                 // 占用一个递增编号
  setPlaza({ loading: true, error: null });
  try {
    const data = await api.plaza({ sort: plaza.sort, /* … */ });
    if (myId !== fetchSeq) return;         // 已有更新的请求发起 → 丢弃自己的结果
    setPlaza({ items: data.items, pagination: data.pagination, loading: false });
  } catch (e) {
    if (myId !== fetchSeq) return;
    setPlaza({ loading: false, error: /* … */ });
  }
}
```

`capsule.ts` 的 `mine` / `favorites` 各持一个独立计数器（`mineSeq` / `favSeq`）；
`resetCapsules()`（登出时调用）会把两个计数器都 `++`，从而让任何在途请求的回写都失效——
干净地丢弃「登出前发出、登出后才返回」的脏数据。

> 为什么用闭包变量而不是 store 字段？因为它纯粹是控制流状态、不需要驱动任何 UI；
> 放进 `createStore` 反而会平白产生订阅。这点与 react-ts 用 `useRef` 同源。

### 9.3 跨 store 联动：收藏数同步

收藏是个典型的跨视图一致性问题：在广场点收藏，「我收藏的」列表和卡片上的计数都要同步。
本项目让 `capsule.ts` 直接 import `plaza` 的 `patchPlazaFavorited` 做投影更新：

```tsx
// capsule.ts toggleFavorite（取消收藏分支）
await api.unfavorite(capsuleId);
setCapsule("favorites", "items", (items) => items.filter((c) => c.id !== capsuleId));
const plazaItem = plaza.items.find((i) => i.id === capsuleId);
patchPlazaFavorited(capsuleId, false, Math.max(0, (plazaItem?.favoriteCount ?? 1) - 1));
```

因为 store 是模块级单例、跨组件树共享，这种「一处操作、多处投影」不需要任何 Context / Provider，
直接函数调用即可——这是模块级响应式相比 React Context 的简洁之处。

---

## 10. 组件与页面的典型模式

### 10.1 数据拉取页
`PlazaPage` / `MeCreatedPage` / `MeFavoritesPage`：`onMount` 或 `createEffect` 里触发 store 的 fetch，
模板用 `<CapsuleGrid items={store.items} loading={store.loading} />` 直接绑定响应式数据。
注意 `items={store.mine.items}` 这种**传 getter 表达式**的写法在 JSX 里是响应式的——
Solid 编译器把属性值包成 thunk，子组件读取时才求值并建立订阅。

### 10.2 受控表单
`LoginPage` / `RegisterPage` / `CreatePage` / `MeProfilePage`：每个字段一个 signal，
`value={x()} onInput={(e) => setX(e.currentTarget.value)}`；提交在 `onSubmit` 里 `e.preventDefault()` 后调 API。
没有 React 的「受控组件每键重渲染整个组件」开销——Solid 只更新那一个 `<input>` 的 value 绑定。

### 10.3 乐观更新 + props 回灌（`FavoriteButton`）
这是体现 Solid 响应式细节的最佳样本。它持有本地 signal 做即时反馈，又要能接受外部（store patch / 详情页）的更新：

```tsx
const [active, setActive] = createSignal(props.capsule.favoritedByMe);
const [count, setCount]   = createSignal(props.capsule.favoriteCount);

// 关键：props 变化时把外部最新值「回灌」进本地 signal。
// 因为本组件可能被复用在列表里，父级 patch 后必须同步，否则显示旧值。
createEffect(() => {
  setActive(props.capsule.favoritedByMe);
  setCount(props.capsule.favoriteCount);
});

async function toggle() {
  if (!auth.user) { /* 匿名 → confirm 跳登录 */ return; }
  // 调 API 成功后同时更新本地 signal 和广场投影
  const r = await api.favorite(props.capsule.id);
  setActive(true); setCount(r.favoriteCount);
  patchPlazaFavorited(props.capsule.id, true, r.favoriteCount);
}
```

> 这个 `createEffect` 在 React 里对应的是「`useEffect(() => setActive(props...), [props...])`」这种受控同步，
> 但 Solid 自动追踪 `props.capsule.favoritedByMe`，省去依赖数组。

### 10.4 定长按位输入（`CapsuleCodeInput`）—— `<Index>` 的教科书用例
8 个胶囊码格子是「定长、按位置更新、每格一个 DOM `<input>`」，正是 `<Index>`（而非 `<For>`）的场景：

```tsx
const refs: Array<HTMLInputElement | undefined> = [];
const chars = () => Array.from({ length: LEN }, (_, i) => (props.value[i] ?? "").toUpperCase());

<Index each={chars()}>
  {(ch, i) => (                          // ch 是 Accessor（() => string），i 是固定数字
    <input
      ref={(el) => (refs[i] = el)}       // 收集 DOM 引用，用于自动聚焦下一格
      value={ch()}
      maxlength={1}
      onInput={(e) => setAt(i, e.currentTarget.value.slice(-1))}
      onKeyDown={(e) => handleKey(i, e)} // Backspace / 方向键在格子间移动焦点
      onPaste={handlePaste}              // 粘贴整串：过滤非法字符后一次性填入
    />
  )}
</Index>
```

- 用 `<For>` 会按元素引用协调——但这里元素是字符串、位置固定，按位置（`<Index>`）才对。
- `ref={(el) => (refs[i] = el)}` 是 Solid 收集 DOM 节点的惯用法（回调 ref），用来实现「输入后自动跳下一格」。
- `value.length === LEN` 时触发 `onComplete`（见 §5.7 关于这里曾经的双触发坑）。

### 10.5 自定义卡片操作（`MeCreatedPage`）
`CapsuleGrid` 接收 `cardSlot={(c) => JSX}`，对每个 item 渲染「撤回」按钮或收藏数——
对应 react-ts 的 `rightSlot` render-prop。在 Solid 里就是一个返回 JSX 的普通函数 prop。

### 10.6 翻页动画 + 自动开启（`CapsuleDetail`）
`CalendarUnit` 用 signal 驱动 fold/unfold 动画相位；到点后用 `setTimeout` 轮询 `onExpired` 刷新开启状态。
**注意用 `window.setTimeout` 拿 `number` 返回值**——否则在装了 `@types/node` 的环境里类型会被推断成 `NodeJS.Timeout`，
与显式 `number` 标注冲突（这是本实现 lint 唯一暴露过的两处错误，见 §17）。

---

## 11. 样式层

`styles/index.css` 直接 `@import` `spec/styles/{palette,tokens,cyber}.css` + Tailwind v4，
与所有前端共享 `cy-*` 组件类与设计令牌。组件层只允许用语义令牌 `var(--color-*)` 和 `cy-*`，禁止硬编码色值。

> ⚠️ SolidJS 的 `style` 对象与 React 不同：**键用 kebab-case 字符串、值必须带单位**。
> 例如 React 的 `style={{ marginLeft: "auto", gap: 6 }}` 在 Solid 要写成 `style={{ "margin-left": "auto", gap: "6px" }}`。
> SVG 属性也用原生 kebab-case：`stroke-width` 而非 `strokeWidth`。

---

## 12. 常见改动指南

| 想做的事 | 改哪里 |
|---|---|
| 加一个页面 / 路由 | `pages/` 新增组件 + `App.tsx` 的 `<Route>` |
| 加一个 API 端点 | `api/client.ts` 的 `api` 对象 + `types/index.ts` 类型 |
| 加一块全局状态 | `stores/` 新建模块级 Signal/Store + 导出动作 |
| 改广场筛选逻辑 | `stores/plaza.ts` |
| 改视觉令牌 | 改 `spec/styles/tokens.css`（**不要**在组件里硬编码） |

---

## 13. SolidJS vs React vs Vue vs Svelte 速查

| 概念 | SolidJS | React | Vue 3 | Svelte 5 |
|---|---|---|---|---|
| 组件函数执行 | **只一次** | 每次渲染 | setup 一次 | 一次 |
| 局部状态 | `createSignal` → `x()` | `useState` → `x` | `ref` → `x.value` | `$state` → `x` |
| 派生 | 函数 / `createMemo` | `useMemo` | `computed` | `$derived` |
| 副作用 | `createEffect`（自动依赖） | `useEffect`（手写依赖） | `watchEffect` | `$effect` |
| 挂载 | `onMount` | `useEffect(fn,[])` | `onMounted` | `$effect`/`onMount` |
| 列表 | `<For>` / `<Index>` | `.map()` | `v-for` | `{#each}` |
| 条件 | `<Show>` | `&&` / 三元 | `v-if` | `{#if}` |
| 全局状态 | 模块级 Signal/Store | Zustand/Context | Pinia | `.svelte.ts` 单例 |
| 渲染模型 | 细粒度，无 VDOM | 虚拟 DOM diff | 虚拟 DOM diff | 编译期，无 VDOM |

---

## 14. 渲染原理：没有虚拟 DOM，更新去哪了？

理解这一点能解释前面所有「为什么 props 不能解构」「为什么读值要调用函数」的根因。

`vite-plugin-solid`（babel-preset-solid）在**编译期**把 JSX 转成真实 DOM 创建 + 细粒度更新表达式。
大致上：

```tsx
<h3>{props.capsule.title}</h3>
```

会被编译成类似：

```js
const el = document.createElement("h3");
// 这一行被包进一个 computation：props.capsule.title 变化时只重跑它，只改这个文本节点
insert(el, () => props.capsule.title);
```

所以：

- **组件函数只运行一次**——它的职责是「建立 DOM 结构 + 注册一批细粒度 computation」，而不是像 React 那样
  「每次状态变化重跑、产出新 VDOM、再 diff」。这就是为什么把响应式数据解构成普通变量会丢失响应性：
  解构发生在那「唯一一次」执行里，拿到的是当时的快照。
- **更新是点对点的**——`setCount(5)` 直接定位到订阅了 `count` 的那个文本节点 / 属性绑定去改，
  不重跑组件、不 diff 子树。一个 1000 行的列表里改一个 item 的标题，只有那一个 `<h3>` 的文本被触碰。
- **`<For>` / `<Show>` 是编译/运行时协作的协调原语**——它们维护一小块「键 → DOM 片段」的映射，
  数据变化时增删/移动 DOM 片段，而不是重建整棵子树。

一句话：React 把「什么变了」交给运行时 diff 去算；Solid 在你写下 `count()` 的那一刻，
就在编译期+运行时记录了「这个 DOM 位置依赖 count」，于是更新时无需计算、直接命中。

---

## 15. 测试策略

```bash
npm test          # vitest，node 环境
```

本项目单测**只测纯逻辑层**，不渲染 Solid 组件：

- `src/utils/format.test.ts` —— 倒计时计算、时间格式化、数字格式化等纯函数，输入输出直接断言。
- `src/api/client.test.ts` —— 用 `configureApi()` 注入假 token 回调、`vi.stubGlobal("fetch", …)` 打桩，
  验证响应解包、`ApiError` 抛出、401 自动 refresh + 重放、refresh 并发去重。**这正是 §8 依赖倒置设计的回报**：
  client 不依赖任何 store，测试里随便注入假回调即可。

为什么不做组件渲染测试？因为**组件级行为已被 `verification/` 的 25 个 Playwright 黑盒用例覆盖**
（真实浏览器、真实后端、真实路由）。单测聚焦那些 Playwright 难以精确触发的分支（如 refresh 竞态），
两层各司其职，不重复造轮子。这也符合本仓库「外部黑盒验证为准」的总原则。

---

## 16. 与契约对齐

| 契约要点 | 落点 |
|---|---|
| 统一响应包装 `{ success, data, message, errorCode }` | `src/api/client.ts` 解包并将失败映射成 `ApiError` |
| 错误码枚举 | `src/types/index.ts` `ErrorCode` |
| 8 位胶囊码 `[A-Z0-9]{8}` | `CapsuleCodeInput` 强制大写 + 字符过滤（§10.4） |
| 广场 sort/filter/q + 分页 | `stores/plaza.ts` + `PlazaToolbar`（搜索 300ms 防抖） |
| JWT + refresh 轮换 | `api/client.ts` 自动 refresh；`stores/auth.ts` 持久化 refresh token + user |
| 头像列表 `/api/v1/avatars` | `RegisterPage` / `MeProfilePage` 取自 API |
| 健康检查 `/api/v1/health` | `AppFooter` / `AboutPage` 渲染当前后端栈 |
| AI 建议 / 推荐端点 | `CreatePage` + `RecommendationStrip`（失败静默、不阻塞创建） |
| 路由路径 | `/c/:code` 与 react-ts / vue3-ts / angular 一致 |

---

## 17. 踩坑 FAQ（本实现实测）

| 现象 | 原因 | 对策 |
|---|---|---|
| 改了 store 字段，组件不更新 | 把 props / store 字段**解构**成了普通变量，丢失响应性（§5.5） | 一律 `props.x` / `store.x` 访问；默认值用 `() => props.x ?? d` |
| effect 莫名多跑、列表请求翻倍 | effect 自动追踪了它调用的函数里同步读取的响应式数据（§5.7） | 用 `untrack(() => fn())` 圈住不想追踪的调用 |
| `style={{ marginLeft: "auto" }}` 不生效 | Solid 的 style 对象用 **kebab-case 键 + 带单位值**，不是 React 的 camelCase + 自动 px | 写成 `style={{ "margin-left": "auto", gap: "6px" }}`；SVG 属性用 `stroke-width` |
| `const t: number = setTimeout(...)` 类型报错 | 装了 `@types/node` 时 `setTimeout` 返回 `NodeJS.Timeout` | 用 `window.setTimeout` / `window.clearTimeout` 拿浏览器的 `number`（§10.6） |
| `<Show>{(x) => x.foo}</Show>` 报 x 可能为空 | callback 形式的参数是 Accessor | 写 `{(x) => x().foo}`，且 `x()` 已被收窄为非空 |
| 首页 `<A href="/">` 一直高亮 | 路由前缀匹配 | 加 `end` 属性做精确匹配（§6） |

读到这里，回到 `frontends/react-ts` 对照同一个页面（比如 `CreatePage` 或 `FavoriteButton`），你会清楚看到：
两边业务逻辑几乎一样，差别只在「React 用 hooks + 重渲染 + VDOM diff」对「Solid 用 signals + 细粒度订阅 + 编译期定位」。
这正是本多栈项目想让你建立的对比直觉。
