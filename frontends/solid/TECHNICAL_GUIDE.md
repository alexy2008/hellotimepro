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
  并发请求共享同一个 `refreshing` Promise 去重。
- **与 store 解耦**：client 不 import store，而是 `auth.ts` 启动时调 `configureApi({ getAccessToken, getRefreshToken, onTokensRefreshed, onAuthLost })` 注入回调。这样 client 与状态实现彻底分离，也避免循环依赖。

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

### 并发请求的「序列号」模式
`plaza.ts` / `capsule.ts` 用闭包变量 `fetchSeq` 防止乱序响应覆盖：每次请求 `++seq` 记下编号，
回写前比对 `if (myId !== fetchSeq) return`，丢弃过期响应。这是与 react-ts 一致的做法（用闭包而非 store 字段，避免无谓订阅）。

---

## 10. 组件与页面的典型模式

- **数据拉取页**（`PlazaPage` / `MeCreatedPage` / `MeFavoritesPage`）：`onMount` 或 `createEffect` 里触发 store 的 fetch，
  模板用 `<CapsuleGrid items={store.items} loading={store.loading} />` 直接绑定响应式数据。
- **受控表单**（`LoginPage` / `RegisterPage` / `CreatePage` / `MeProfilePage`）：每个字段一个 signal，
  `value={x()} onInput={e => setX(e.currentTarget.value)}`；提交在 `onSubmit` 里 `e.preventDefault()` 后调 API。
- **乐观更新**（`FavoriteButton`）：本地 signal 立即翻转 active/count，再调 API，并通过 `patchPlazaFavorited` 同步广场列表；
  `createEffect` 监听 props 变化把外部更新同步回本地。
- **自定义卡片操作**（`MeCreatedPage`）：`CapsuleGrid` 接收 `cardSlot={(c) => JSX}`，对每个 item 渲染「撤回」按钮或收藏数，
  对应 react-ts 的 `rightSlot`/render-prop。
- **翻页动画 + 自动开启**（`CapsuleDetail`）：`CalendarUnit` 用 signal 驱动 fold/unfold 动画相位；
  到点后用 `setTimeout` 轮询 `onExpired` 刷新开启状态（注意用 `window.setTimeout` 拿 `number` 返回值，
  否则在装了 `@types/node` 的环境里类型会是 `Timeout`）。

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

读到这里，回到 `frontends/react-ts` 对照同一个页面（比如 `CreatePage`），你会清楚看到：
两边业务逻辑几乎一样，差别只在「React 用 hooks + 重渲染」对「Solid 用 signals + 细粒度订阅」。
这正是本多栈项目想让你建立的对比直觉。
