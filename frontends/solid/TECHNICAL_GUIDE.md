# HelloTime Pro SolidJS 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 SolidJS、TypeScript、Vite、单页应用（SPA）这套现代前端栈的读者。读过 React 版手册（`frontends/react-ts/TECHNICAL_GUIDE.md`）更好——本文会不断拿两者对照。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- SolidJS、TypeScript、Vite、Solid Router、Signals / Store 与 spec/styles 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 Solid 的核心概念（组件只运行一次、Signal、Store、Effect 与 owner、控制流）；第 6 节快速过 TypeScript；第 7～13 节按一次「打开页面」的生命周期分层细讲；第 14～15 节是测试与常见改动；第 16～18 节是对照表、渲染原理与踩坑清单。

## 1. 技术选型与设计特色

HelloTime Pro 的 Solid 前端基于 **SolidJS + TypeScript + Vite**，用 **Solid Router** 控制路由，状态直接用 Solid 自带的 **Signal / Store**（不需要第三方状态库），样式原样引入 `spec/styles` 的两套皮肤（2.0）。

* **SolidJS（细粒度响应式，没有虚拟 DOM）**：写法和 React 一样是 JSX + 函数组件，但**组件函数只运行一次**。它的工作是搭好 DOM、登记一批「这个文本 / 属性依赖哪个信号」的细粒度计算；之后信号一变，只有用到它的那个 DOM 位置被更新，不重跑组件、不做 diff。
* **Signal / Store（框架自带的状态）**：`createSignal` 是最小的响应式单元，`createStore` 让嵌套对象的每个字段都能被单独订阅。它们可以在组件之外（模块顶层）创建，天然就是全局 store，不需要 Redux / Zustand。
* **Solid Router（声明式路由表）**：`<Route path component>` 平铺出路由表，`useParams()`、`useLocation()` 返回的也是响应式对象。
* **TypeScript**：类型与 `openapi.yaml` 对齐，`tsc --noEmit` 是构建的第一步，类型错的代码无法构建。
* **Vite**：基于原生 ESM 的开发服务器与打包器；`vite-plugin-solid` 在编译期把 JSX 变成「真实 DOM 创建 + 细粒度更新」的代码。
* **双皮肤与设计令牌（2.0）**：「时笺」「琥珀」两套皮肤 × 明暗，全部样式来自 `spec/styles`（每条规则按 `:root[data-skin]` 限定，两套同时加载）。本前端不写组件样式，只按 2.0 原型写出相同的 DOM 结构与类名；切换皮肤 / 明暗只改 `<html>` 上的两个属性。
* **状态建在路由页、视图按皮肤分**：业务逻辑写成 primitive（`src/primitives/`，React 版叫 hooks），由路由页创建一次，再交给 `src/skins/paper` 或 `src/skins/amber` 的视图。换皮肤只换视图，状态不动——这是本前端最值得看的组织方式，也是它和 React 版最大的结构差异（第 11 节细讲）。

## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。Solid 前端的职责是：

- 渲染所有页面（首页广场 / 开启 / 详情 / 创建 / 我的 / 登录 / 注册 / 关于），每个页面都有「时笺」「琥珀」两套视图。
- 调用后端 `/api/v1/*`（经 `:9080` 反代），把 JSON 画成卡片、表单、详情；2.0 新增 `/plaza/stats`、`/me/stats`。
- 维护客户端状态：登录态、皮肤与明暗、广场查询条件、创建页草稿。
- 守卫需要登录的路由（`/create`、`/me/*`），未登录跳 `/login?redirect=…`；access token 过期自动刷新并重放。

```
src/
├── main.tsx / App.tsx   入口：首帧前恢复登录态，挂路由表
├── app/Layout.tsx       总布局：按皮肤挑页头 / 页脚 / 底栏
├── pages/               路由入口：建好本页状态，<Skinned> 按皮肤挑视图
├── primitives/          业务逻辑（两套皮肤共用）
├── stores/              模块级 Signal / Store：auth · ui · plaza · feedback
├── api/ · types/        接口客户端与类型
├── lib/                 纯工具：图标、时间说法、头像、专属色、账号规则、回跳
├── components/          结构相同只靠样式换肤的部件
└── skins/paper|amber/   两套视图
```

一次「打开首页」的数据流：`pages/PlazaPage` 创建 `createPlazaHome()` 与 `createCodeOpen()` → `<Skinned>` 读 `skin()` 渲染 `skins/amber/HomePage` → primitive 里的 effect 调 `stores/plaza.refreshAll()` → `api/client` 发请求 → store 字段更新 → 只有读了那些字段的 DOM 位置更新。换成时笺时，只有视图换成 `skins/paper/HomePage`，路由页建好的状态原样交给新视图。

## 3. 如何运行和验证

```bash
cd frontends/solid
./run                          # 开发模式，端口 7180
./build                        # 类型检查 + 生产构建到 dist/
./test                         # vitest 单测
```

打开浏览器访问 `http://localhost:7180`。`./run` 做的事：

1. 检查 `node_modules` 是否存在，没有就 `npm install`。
2. 执行 `npm run dev`，即 `vite --host 0.0.0.0 --port 7180`。
3. Vite 按需编译 `.ts/.tsx`，修改文件自动热更新（HMR）。

API 代理由 `vite.config.ts` 配置：`/api/*` 与 `/static/*` 转发到 `BACKEND_PROXY`（默认 `http://localhost:9080`，即仓库的反向代理；也可以直连某个后端：`BACKEND_PROXY=http://localhost:29010 ./run`）。

生产构建（`./build`）：

```bash
tsc --noEmit -p tsconfig.app.json   # 仅做类型检查
vite build                          # 打包到 dist/（HTML + JS + CSS + 字体）
```

黑盒验证在仓库根目录跑：

```bash
./verification/scripts/verify-ui-smoke.sh solid        # 44 条 × 两套皮肤
./verification/scripts/verify-design-tokens.sh solid   # 自己的样式只用语义令牌
```

## 4. 入口链路：`index.html` → `main.tsx` → `App.tsx`

### 4.1 `index.html`：SPA 的唯一 HTML

整个应用只有一个 `<div id="root"></div>`。`<head>` 里的内联 `<script>` 在 Solid 启动前就同步读 `localStorage`，写好 `data-skin`（时笺 / 琥珀）与 `data-theme`（明 / 暗），并设置地址栏颜色——避免首帧闪出另一套皮肤或另一种明暗。`<script type="module" src="/src/main.tsx">` 让 Vite 把 TSX 当 ES Module 加载。

### 4.2 `main.tsx`：先恢复登录态，再挂载

```tsx
import { render } from "solid-js/web";
import { App } from "./App";
import { hydrateAuth } from "@/stores/auth";
import "./styles/index.css";

hydrateAuth();                                          // 首次渲染之前从 localStorage 恢复
render(() => <App />, document.getElementById("root")!);
```

- `render(() => <App />, el)`：Solid 的挂载入口。第一个参数是**函数**——Solid 要在自己建立的响应式根（root）里调用它，这样里面创建的所有计算都有归属，卸载时能一起清理。
- `hydrateAuth()` 放在 `render` 之前：守卫（未登录跳登录、已登录访问登录页跳走）在第一帧就能拿到正确的 user。
- `import "./styles/index.css"`：让 CSS 也走 Vite 的依赖图。

### 4.3 `App.tsx`：路由表

```tsx
export function App() {
  onMount(() => {
    if (auth.refreshToken) void refreshMe();   // 本地有 refresh token 时确认一次登录态
  });
  return (
    <Router root={Layout}>
      <Route path="/" component={PlazaPage} />
      <Route path="/create" component={GatedCreate} />
      <Route path="/capsules/:code" component={CapsuleByCodePage} />
      <Route path="/me/:tab" component={GatedMe} />
      <Route path="*" component={NotFoundPage} />
      {/* …其余路由见源码 */}
    </Router>
  );
}
```

`root={Layout}` 是所有路由共用的外壳，当前路由的页面作为 `props.children` 交给它（第 8 节）。`onMount` 在组件挂载后运行一次、不追踪依赖，相当于 React 的 `useEffect(fn, [])`。

## 5. SolidJS 的核心概念

Solid 的 JSX 看起来和 React 几乎一样，但心智模型完全不同。先记住一句话：**组件函数只运行一次，之后的更新全靠信号。**

### 5.1 组件只运行一次

```tsx
function Hello(props: { name: string }) {
  console.log("这一行只打印一次");
  return <h1>你好，{props.name}</h1>;
}
```

React 的组件每次状态变化都会从头再跑一遍，产出新的虚拟 DOM 去 diff；Solid 的组件只在创建时跑一遍，它的产物是真实的 DOM 节点加上一批细粒度的计算（`{props.name}` 这个位置会被编译成「名字变了就只改这个文本节点」）。所以：

- 组件体里可以直接写「只做一次」的事（建状态、注册监听），不需要 `useRef` / `useCallback` 那一套。
- 想让某个值随状态变化，必须在 JSX 里或计算里**读信号**，而不是在组件体顶部算好存成变量。

### 5.2 `createSignal`：最小响应式单元

```tsx
const [count, setCount] = createSignal(0);
count();                 // 读：在响应式上下文里读会建立订阅
setCount(1);             // 写：通知所有订阅者
setCount((c) => c + 1);  // 函数式更新
```

`count` 是一个 **getter 函数**，读值要调用 `count()`——这正是 Solid 追踪依赖的方式：只有在计算（JSX 表达式、`createEffect`、`createMemo`）运行期间调用的 getter，才会被记成依赖。

本项目 `stores/ui.ts` 就是一个例子：模块顶层 `createSignal` 出 `skin` 与 `theme`，导出只读的 getter 与 `setSkin` / `toggleTheme` 动作，任何组件里写 `skin() === "paper"` 就订阅了皮肤。

### 5.3 `createStore`：嵌套对象的细粒度响应

状态是一个对象（尤其有嵌套或数组）时用 `createStore`。它返回一个 proxy，**读到哪个字段就订阅哪个字段**：

```tsx
const [plaza, setPlaza] = createStore({ sort: "new", items: [], counts: null, ... });
plaza.sort;                                              // 只订阅 sort
setPlaza({ sort: "hot", page: 1 });                      // 浅合并顶层字段
setPlaza("items", (it) => it.id === id, { favoriteCount: 3 });  // 按路径改数组里符合条件的那几项
setPlaza("items", reconcile(data.items, { key: "id" })); // 按 id 对齐新旧数组，没变的项保持原对象
```

`stores/plaza.ts` 用 `reconcile` 写回列表：刷新后同一枚胶囊仍是同一个对象，`<For>` 不会重建它的卡片；收藏后的 `patchFavorited` 只改那一枚的两个字段，整页只有那颗心和那个数字会动。

### 5.4 派生值：普通函数与 `createMemo`

```tsx
const opened = () => props.c.isOpened || openAt() <= props.now;   // 读 opened() 时才计算
const due = createMemo(() => items.some((c) => ms(c.openAt) <= now()));  // 缓存，依赖变了才重算
```

大多数派生直接写箭头函数；结果要被多处读、或者计算较重、或者你需要「值没变就不通知下游」时，用 `createMemo`。`primitives/plazaHome.ts` 的 `due`（是否有胶囊刚好到点）就是 memo：它从 false 变 true 的那一刻才触发一次整页刷新。

### 5.5 `createEffect`、owner 与 `onCleanup`

```tsx
createEffect(() => {
  if (skin() !== "amber" || !canvas) return;
  onCleanup(startSky(canvas, theme() !== "light"));   // 重跑前 / 销毁时先停掉旧动画
});
```

- `createEffect` 的依赖是**自动收集**的：运行期间读过的所有信号。皮肤或明暗一变，上面这个 effect 重跑。
- 每个组件、每个 effect、每个 memo 都是一个 **owner**。在它里面创建的计算、登记的 `onCleanup` 都归它管；它被销毁（组件卸载、effect 重跑、`<Show>` 换分支）时，下面挂着的一切一起清理。这棵 owner 树就是 Solid 的生命周期——本项目「状态建在路由页、离开路由就清空」完全建立在它之上。
- `on(deps, fn)` 可以显式指定依赖，`fn` 里的读取不再被追踪；第二个参数是上一次的值。`stores/auth.ts` 的 `onAccountChange` 用它监听「账号 id 变了」：

```ts
createEffect(on(() => auth.user?.id, (id, prev) => { if (prev && id !== prev) fn(); }));
```

> ⚠️ 不要给它加 `{ defer: true }`：被 defer 跳过的那一次不会记下旧值，第一次登出时 `prev` 是 `undefined`，回调就漏了。

- `untrack(fn)`：在计算里调用但不想成为依赖的读取，用它圈起来（第 11 节「我的」页签就用到了）。

### 5.6 props 不要解构，JSX 类型的 prop 只读一次

```tsx
function Card(props: { c: CapsuleListItem }) {   // ✓ 一律 props.c.title
  return <h3>{props.c.title}</h3>;
}
function Card({ c }) { ... }                      // ✗ 解构发生在那唯一一次执行里，之后不再更新
```

Solid 把 props 编译成 getter：父组件传 `now={now()}`，子组件每次读 `props.now` 都拿到最新值。反过来，**传 JSX 的 prop 每读一次就新建一次节点**：`trail={<NickState …/>}` 在子组件里读两次就是两份 DOM。`components/forms.tsx` 的 `Field` 用 `children(() => p.trail)` 解析一次，「判断有没有」和「渲染」共用同一份。

### 5.7 控制流：`<Show>` / `<For>` / `<Index>` / `<Switch>`

```tsx
<Show when={auth.user} fallback={<LoginButtons />}>
  {(user) => <Avatar id={user().avatarId} />}         {/* user() 已收窄为非空 */}
</Show>
<Show when={params.code} keyed>{(code) => <CapsuleView code={code} />}</Show>  {/* 值一变整块重建 */}
<For each={plaza.items}>{(c, i) => <PaperCard c={c} i={i()} />}</For>      {/* 按对象引用 */}
<Index each={cells()}>{(ch, i) => <input value={ch()} />}</Index>          {/* 按位置 */}
<Switch fallback={<List />}><Match when={loading()}>…</Match><Match when={error()}>…</Match></Switch>
```

- 条件和列表不能像 React 那样写 `&&` / `.map()` 了事（能跑，但每次都会整块重建）；用这些组件，Solid 才能只增删变化的那一块 DOM。
- `keyed` 的 `<Show>` 是 React 里「改 `key` 让组件重新挂载」的对应物：详情页按 `code` 重建状态、翻页数字按数字重建 `<span>` 重播动画，都用它。
- `<For>` 适合可增删的列表（广场、收藏）；`<Index>` 适合定长、按位更新的东西（8 格输码、日历的 42 格）。

### 5.8 JSX 与 React 的几处写法差异

| React | Solid | 说明 |
|---|---|---|
| `className="x"` | `class="x"` | Solid 直接用 HTML 属性名 |
| `htmlFor` | `for` | 同上 |
| `onChange`（输入框） | `onInput` | React 的 onChange 其实是 input 事件；Solid 的 `onChange` 是原生 change |
| `style={{ marginTop: 8 }}` | `style={{ "margin-top": "8px" }}` | kebab-case 键，数值不会自动补 `px` |
| `dangerouslySetInnerHTML` | `innerHTML` | 只用于本地常量（图标路径、关于页原则） |
| `ref={useRef()}` | `let el; <div ref={el}>` | 直接给变量赋值，或传回调 |
| `key={x}` 重新挂载 | `<Show when={x} keyed>` | 见 5.7 |

## 6. TypeScript 快速概览

`.ts` 与 `.tsx` 是带类型注解的 JavaScript，读代码时可以把冒号后面的内容当注释。本项目常见的写法：

```ts
const [c, setC] = createSignal<CapsuleDetail | null>(null);  // 泛型参数约束信号里的值
type DetailStatus = "loading" | "ok" | "missing" | "error";  // 联合类型
export type CapsuleForm = ReturnType<typeof createCapsuleForm>;  // 从函数返回值推出类型，视图的 props 用它
e instanceof ApiError                                         // 运行时检查，TS 会收窄类型
```

`tsconfig.app.json` 开了 `strict`，`jsx: "preserve"` + `jsxImportSource: "solid-js"` 让 TS 用 Solid 的 JSX 类型检查模板。Solid 的 JSX 类型里漏了几个 SVG 属性（`textLength`、`lengthAdjust`、`focusable`），`src/solid-jsx.d.ts` 用模块扩充补上。

## 7. 路由层：`@solidjs/router`

```tsx
<Router root={Layout}>
  <Route path="/" component={PlazaPage} />
  <Route path="/capsules/:code" component={CapsuleByCodePage} />
  <Route path="/me" component={ToMyCreated} />           {/* 渲染 <Navigate href="/me/created" /> */}
  <Route path="/me/:tab" component={GatedMe} />          {/* 三个页签共用一个页面组件 */}
  <Route path="*" component={NotFoundPage} />
</Router>
```

- **路径参数**：`useParams()` 返回响应式对象，`params.code` 变了，读它的地方会更新——但路由组件本身**不会重建**。所以详情页用 `<Show when={params.code} keyed>` 包一层，换码就整份状态重建（第 11 节）。
- **跳转**：站内链接直接写 `<a href="/open">`，路由器在 `document` 上拦截同源链接的点击、改走前端路由，不刷新页面。编程式跳转用 `const navigate = useNavigate(); navigate("/me/created", { replace: true })`。渲染期间要跳走（守卫）用 `<Navigate href="…" />`。
- **为什么不用 `<A>`**：它会自动加 `active` / `inactive` 类；本项目的高亮类名是 `is-active`，由 `components/shellParts.tsx` 的 `createNav()` 显式给出。
- **拦截匿名用户的创建入口**：路由器先调 `delegateEvents(["click"])` 再挂自己的监听，Solid 的委托事件因此先运行。`components/LoginPrompt.tsx` 的 `CreateLink` 在 `onClick` 里 `preventDefault()`，路由器看到 `defaultPrevented` 就不跳了，先弹确认框，确认后再 `navigate(loginPath("/create"))`。

## 8. 布局、守卫与按皮肤挑视图

### 8.1 `app/Layout.tsx`：总布局

所有路由都渲染在 `Layout` 里：`<main id="view">{props.children}</main>`。它用 `createEffect(on(() => location.pathname, …))` 在换页时写 `body[data-route]` 并滚回顶部；挂一次时笺的 SVG 滤镜（`#f-rough`、`#f-ink`）与琥珀的星空背景；页头、页脚、底栏各用一次 `<Skinned>` 按皮肤挑。`id="view"`、`body[data-route]` 都是 `spec/styles` 依赖的 DOM 约定，照原型写。

### 8.2 `pages/Skinned.tsx`：按皮肤挑视图

```tsx
export function Skinned(props: { paper: JSX.Element; amber: JSX.Element }) {
  return <Show when={skin() === "paper"} fallback={props.amber}>{props.paper}</Show>;
}
```

`paper={<PaperHomePage h={h} />}` 被编译成 getter，`<Show>` 只在需要时才读，所以同一时刻只会创建当前皮肤那一份视图。换皮肤时旧视图销毁（它的 owner 下的计算、监听一起清理），新视图创建——而外面路由页建好的状态原样传给它。

### 8.3 `components/AuthGate.tsx`：路由守卫

```tsx
export function AuthGate(props: { children: JSX.Element }) {
  const location = useLocation();
  return (
    <Show when={auth.hydrated}>
      <Show when={auth.user || auth.refreshToken}
            fallback={<Navigate href={loginPath(location.pathname + location.search)} />}>
        {props.children}
      </Show>
    </Show>
  );
}
```

只有 refresh token（刷新页还没拿到 access token）也放行——接下来的接口调用会自动 refresh（第 9 节）。跳转目标是 `/login?redirect=%2Fcreate` 这样编码好的串，登录成功后 `safeRedirect` 只接受站内路径。已登录访问登录 / 注册页，由 `pages/LoginPage.tsx` 的 `guestRedirect()` 在进入那一刻判断一次（用 `untrack` 读，之后登录成功不会被它抢先跳走）。

## 9. 数据层：`api/client.ts`

与 React 版逐字相同——它不依赖任何框架：

1. `request<T>(path, opts)` 自动设置 `Content-Type` / `Accept`、序列化 `body`、拼 `Authorization` 头；解开后端的统一外壳 `{ success, data, message, errorCode }`，调用者只拿到 `data`；失败抛 `ApiError`（带 HTTP 状态、errorCode、字段级 details）。
2. **401 自动 refresh 并重放**：模块级变量 `refreshing` 保证一波并发 401 只发一次 `/auth/refresh`，其余请求 `await` 同一个 Promise；`_retry` 标记防止重放后再 401 陷入死循环。
3. **依赖注入**：client 不 `import` auth store（store 反过来要 import client，会循环）。`stores/auth.ts` 加载时调用 `configureApi({ getAccessToken, getRefreshToken, onTokensRefreshed, onAuthLost })` 把 store 的读写函数交给 client。单元测试也因此能直接注入假回调（`api/client.test.ts`）。

## 10. 状态层：模块级 Signal / Store

| 模块 | 关心什么 | 持久化 |
|---|---|---|
| `stores/auth` | user / accessToken / refreshToken / hydrated；`refreshMe()` 按会话单飞；`onAccountChange(fn)` | refreshToken + user → localStorage（`main.tsx` 在首次渲染前恢复） |
| `stores/ui` | skin（paper / amber）· theme（light / dark）及带转场的切换 | localStorage `hellotime.skin` / `hellotime.theme` |
| `stores/plaza` | sort / filter / q / qInput / page + 列表、筛选数量、年鉴、精选；搜索防抖计时器 | 否；两套皮肤共用，切皮肤后条件与正在输入的字都在 |
| `stores/feedback` | Toast 列表、当前确认框；`toast()`、`confirmDialog()`、`copyText()` | 否 |

几个要点：

- **只读导出 + 动作函数**：模块导出 store 本身（只读用）与 `setSort` / `refreshAll` / `patchFavorited` 这样的动作，写操作集中在模块里，组件不直接 `setPlaza`。
- **并发请求的序列号**：`fetchList` 每次发请求先 `++listSeq`，回来时序号对不上就丢弃——用户快速切筛选时，旧响应不会覆盖新结果。详情、「我的」列表与统计、输码查询也用请求序号忽略过期响应。广场查询条件变化时清理旧列表和分页，搜索词变化时清理旧数量。若服务端返回的总页数小于当前页，重新读取最后一个有效页。
- **跨 store 联动**：`FavButton` 通过回调把收藏结果写回详情，或从「我收藏的」移除取消收藏的行并刷新 `/me/stats`。对公开胶囊还会调用 `patchFavorited(id, favorited, count)`，同步广场票数并重新读取最热排序和精选。
- **View Transition 不必等**：`setSkin` 在 `document.startViewTransition(cb)` 的回调里写信号，Solid 的 DOM 更新是同步的，回调返回时新皮肤已经画好（Vue 需要 `return nextTick()`）。
- **确认框的正文写成函数**：`confirmDialog({ body: () => <p>…</p>, mark: () => <Seal … /> })`。Solid 的 JSX 一写出来就是真实节点，在点击回调里直接创建的话没有 owner 管它；交给 `DialogHost` 在自己的组件树里调用就归它管了。
- **草稿**是 `primitives/capsuleForm.ts` 里的模块级 store：切皮肤、离开再回来都在；`onAccountChange(resetDraft)` 让登出、换账号时清空；每次改动 `draftVersion++`，封存成功时只有版本没变（等待期间没人再改过）才清空。日期尚未选全时记录 `openAtMissing`，两套皮肤都提示补全日期，阻止封存。

## 11. 路由页、primitives 与皮肤视图

### 11.1 一个页面的三层

```tsx
// pages/CreatePage.tsx
export function CreatePage() {
  return <Show when={auth.user?.id} keyed>{(id) => <CreateForm owner={id} />}</Show>;  // 按账号重建
}
function CreateForm(_props: { owner: string }) {
  const f = createCapsuleForm();          // 提交锁、AI 任务、成功回执都归它
  return <Skinned paper={<PaperCreatePage f={f} />} amber={<AmberCreatePage f={f} />} />;
}
```

1. **路由页**（`pages/`）：创建本页的 primitive，决定它活多久（按账号、按胶囊码、按页签），再用 `<Skinned>` 挑视图。
2. **primitive**（`primitives/`）：业务逻辑，返回一组信号与动作，比如 `f.draft.title`、`f.submit()`、`f.aiBusy()`。它们里面的 `createEffect` / `onCleanup` 归调用它的路由页所有。
3. **皮肤视图**（`skins/<skin>/`）：只负责把状态画成各自的样子，照原型写 DOM 与类名。

正在封存时切皮肤：时笺视图连同长按进度环一起销毁，琥珀视图拿到同一个 `f`，`f.submitting()` 仍为真、`f.created()` 一到就显示回执。

### 11.2 状态活多久，由它建在哪决定

| 状态 | 建在 | 什么时候重建 / 清空 |
|---|---|---|
| 首页 / 开启页的 8 格输码 | `PlazaPage` / `OpenPage`（经 `CodeOpenContext` 交给输码框） | 离开路由；改码时旧查询与延迟跳转作废（代数守卫） |
| 胶囊详情 | `CapsuleByCodePage` 里按 `code` keyed | 换码、离页；开启动画与轮询在视图里，换皮肤时旧视图 `abort()` |
| 创建表单 | `CreatePage` 里按 `user.id` keyed | 换账号、离页（草稿本身在模块 store，见第 10 节） |
| 登录 / 注册表单 | `LoginPage` / `RegisterPage` | 离页、提交成功 |
| 「我的」页签 | `MeView` 里的 `createMemo`，每个页签一份 | 换页签、离页 |

「我的」三个页签共用一个路由组件（切页签时页头与统计不重绘），每个页签的状态这样建：

```tsx
const body = createMemo<MeBody>(() => {
  const tab = props.tab;
  return untrack(() =>
    tab === "profile"
      ? { tab, profile: createProfile(), avatarIds: createAvatarIds() }
      : { tab, list: createMyList(tab, stats.refresh) },
  );
});
```

memo 重跑时，上一次在它里面建的状态（和它们的 effect、onCleanup）一起销毁，所以离开「账号设置」页签就等于清空了资料与密码表单。`untrack` 必不可少：`createProfile()` 创建时会读 `auth.user`，不圈起来的话，保存资料后 `refreshMe` 改了 `auth.user`，memo 就会把正在改的表单整份重建。

### 11.3 表单：受控输入

所有输入都是受控的：值在 primitive 的信号里，`onInput` 写回去，`value={f.email()}` 读出来。注意一个和 React 不同的细节：Solid 只在信号值**变了**时才写 `input.value`。如果处理函数把输入清洗掉了（输码框丢掉非法字符），信号值没变，DOM 里就会留着用户刚敲的那个字符——两套输码框都在 `onInput` 里把清洗后的值写回 `el.value`。

输码状态使用不换行空格保留中间空格位，视图按格渲染，查询只接收完整的八位码。标题、正文和广场搜索用 `readLimitedInput` 按 Unicode 码点限长，并把处理后的值写回原生输入框。

### 11.4 组件分类

| 位置 | 放什么 |
|---|---|
| `components/` | 结构两套相同的部件：`Seg`（分段控件与 `createSlider` 滑块定位）、`FavButton`、`LoginPrompt`（`askLogin`、`CreateLink`）、`Feedback`（Toast / 确认框宿主）、`forms`（字段、密码、昵称状态、头像选择、`createShake`）、`shared`（头像、技术栈图标、皮肤开关、「加载更多」、`createHealth`）、`shellParts`（导航高亮、用户菜单）、`AuthGate` |
| `skins/<skin>/parts.tsx` | 皮肤专属的小件：时笺的印章、火漆、信封、邮戳、刻度尺、翻页数字、邮票；琥珀的胶囊插画、徽标、邮戳、翻牌倒计时、码牌 |
| `skins/<skin>/*.tsx` | 页面视图与卡片、外壳、输码框 |

### 11.5 测试钩子

每个关键元素都带 `spec/ui/testids.md` 规定的 `data-testid` 与状态属性（`data-state`、`data-code`、`data-selected`、`aria-pressed`…）。UI 冒烟只靠它们定位，所以两套皮肤跑同一套用例。布尔值写成 `data-selected={String(on())}`，保证属性值是 `"true"` / `"false"`。

## 12. 工具层：`lib/`

| 文件 | 内容 |
|---|---|
| `fmt.ts` | 时间说法（`span`：「2 年 8 个月」）、倒计时拆分、等待进度、农历、`reducedMotion()`、`focusIfIdle()`、`addCalendarYears()`（开启时间上限：10 个日历年，与服务端同一算法） |
| `icons.tsx` | 24 网格线性图标（`<Icon name="pen" />`） |
| `avatars.ts` | 构建期内联 `spec/avatars/v2` 的单线徽记（`import.meta.glob(..., { query: "?raw" })`） |
| `palette.ts` | 琥珀的胶囊专属色：FNV-1a + OKLCH（`docs/02-design.md §9.6`） |
| `about.ts` | 关于页共用文字、技术栈角色名、本前端技术栈 |
| `account.ts` | 邮箱 / 昵称（按 Unicode 码点）/ 密码规则、`nickState`、后端字段错误映射 |
| `redirect.ts` | 登录回跳：只接受站内路径 |

## 13. 样式层：spec/styles

`src/styles/index.css` 只做三件事：引入 `@fontsource` 自托管字体；按「base → 时笺 → 琥珀 → shell」的顺序引入 `spec/styles`；引入 `app.css`（让 `#root` 不参与布局 + 「加载更多」的居中）。本前端不写组件样式，也不用 Tailwind。

想改长相：改 `spec/styles/<skin>/*.css`（所有实现一起受益），并在原型里两套皮肤、明暗都看一遍。想加只属于本前端的胶水样式：写进 `app.css`，只能用 `base.css` 刻度与语义令牌（`--color-*` 等），`verify-design-tokens.sh solid` 会检查。

## 14. 测试

- **单元测试**（vitest，node 环境，`./test`）：只测纯逻辑，不渲染组件。
  - `lib/lib.test.ts`：时间说法、倒计时、等待进度、专属色确定性、登录回跳。
  - `lib/account.test.ts`：昵称按码点校验（`𠮷的草稿` 合法、21 位超长）、`invalid` 与 `taken` 的区分、日历年上限（2 月 29 日落到平年）、页码列表。
  - `api/client.test.ts`：refresh 单飞与重放、登出不触发刷新。
- **UI 冒烟**（Playwright，`verification/ui`）：44 条用例 × 两套皮肤，真实浏览器、真实后端，只靠测试钩子定位；`SKINS=paper` 可只跑一套。组件级行为交给它覆盖，两层各司其职。

## 15. 常见改动指南

- **新增一个页面**：在 `primitives/` 写逻辑（`createXxx()`）→ 在 `skins/paper` 与 `skins/amber` 各写一份视图（照原型的结构与类名，接收 primitive 作 prop）→ 在 `pages/` 加一个路由入口（建状态 + `<Skinned>`）→ 在 `App.tsx` 登记 → 按 `spec/ui/testids.md` 加测试钩子。
- **新增一个接口**：先改 `spec/api/openapi.yaml` → 在 `types/` 加类型 → 在 `api/client.ts` 加方法 → 在 primitive 或 store 里调用。
- **新增一份全局状态**：在 `stores/` 用 `createSignal` / `createStore` 建在模块顶层，导出只读值与动作函数；需要监听别的状态时，把 `createEffect` 放进 `createRoot` 里（参考 `onAccountChange`）。
- **调整视觉**：改 `spec/styles`，不要在组件里写样式。

## 16. SolidJS vs React vs Vue vs Svelte 速查

| 概念 | SolidJS | React | Vue 3 | Svelte 5 |
|---|---|---|---|---|
| 组件函数执行 | **只一次** | 每次渲染 | setup 一次 | 一次 |
| 局部状态 | `createSignal` → `x()` | `useState` → `x` | `ref` → `x.value` | `$state` → `x` |
| 派生 | 函数 / `createMemo` | `useMemo` | `computed` | `$derived` |
| 副作用 | `createEffect`（自动依赖） | `useEffect`（手写依赖） | `watchEffect` / `watch` | `$effect` |
| 挂载 / 清理 | `onMount` / `onCleanup` | `useEffect` 及其返回值 | `onMounted` / `onUnmounted` | `onMount` / `$effect` 返回值 |
| 列表 | `<For>` / `<Index>` | `.map()` + `key` | `v-for` + `:key` | `{#each}` |
| 条件 | `<Show>` / `<Switch>` | `&&` / 三元 | `v-if` | `{#if}` |
| 重建子树 | `<Show keyed>` | 改 `key` | 改 `:key` | `{#key}` |
| 跨层传递 | `createContext` / `useContext` | Context | `provide` / `inject` | `setContext` |
| 全局状态 | 模块级 Signal / Store | Zustand / Context | Pinia | `.svelte.ts` 单例 |
| 渲染模型 | 细粒度，无 VDOM | 虚拟 DOM diff | 虚拟 DOM diff | 编译期，无 VDOM |

本项目里同一份逻辑的四种写法：React 的 `hooks/useCreateCapsule.ts`、Vue 的组合式函数、Svelte 的 runes、Solid 的 `primitives/capsuleForm.ts`——对照着读最能看出差别。

## 17. 渲染原理：没有虚拟 DOM，更新去哪了？

`vite-plugin-solid`（babel-preset-solid）在**编译期**把 JSX 转成真实 DOM 的创建代码加细粒度的更新表达式。大致上：

```tsx
<h3 class="cap__title">{props.c.title}</h3>
```

会被编译成类似：

```js
const el = template(`<h3 class="cap__title">`)();   // 静态结构一次性克隆出来
insert(el, () => props.c.title);                    // 只有这个文本位置依赖 title
```

所以：

- **组件函数只运行一次**——它的职责是「建立 DOM 结构 + 注册一批细粒度计算」，而不是每次产出新 VDOM 再 diff。把响应式数据解构成普通变量会丢失响应性，原因就在这里：解构发生在那唯一一次执行里。
- **更新是点对点的**——`setPlaza("items", …, { favoriteCount: 3 })` 直接定位到读了那一枚 `favoriteCount` 的文本节点去改，不重跑组件、不 diff 子树。
- **控制流组件是协调原语**——`<For>` / `<Show>` 维护一小块「键 → DOM 片段」的映射，数据变化时增删、移动片段，而不是重建整棵子树。

一句话：React 把「什么变了」交给运行时 diff 去算；Solid 在你写下 `count()` 的那一刻就记下了「这个 DOM 位置依赖 count」，更新时无需计算、直接命中。

## 18. 踩坑 FAQ（本实现实测）

| 现象 | 原因 | 对策 |
|---|---|---|
| 改了 store 字段，组件不更新 | 把 props / store 字段解构成了普通变量（§5.6） | 一律 `props.x` / `store.x` 访问 |
| effect 莫名多跑、请求翻倍 | effect 自动追踪了它调用的函数里同步读取的信号（§5.5） | 用 `on(dep, fn)` 指定依赖，或 `untrack(() => fn())` 圈住 |
| 登出后草稿没清 | `on(…, { defer: true })` 跳过的那一次不记旧值 | 不加 defer，用「旧值为空就不触发」判断首次 |
| 同一个小部件出现两份 | JSX 类型的 prop 每读一次就新建一次节点（§5.6） | `children(() => props.x)` 或 `createMemo` 只读一次 |
| 输码框里留着被过滤掉的字符 | 信号值没变时 Solid 不回写 DOM（§11.3） | 在 `onInput` 里手动写回 `el.value` |
| `/capsules/A` 跳到 `/capsules/B` 还显示旧数据 | 同一路由换参数，组件不重建 | `<Show when={params.code} keyed>` |
| 骨架屏、标尺刻度位置不对 | Solid 的 style 不自动补 `px`、键要 kebab-case | `style={{ width: "150px", "margin-top": "12px" }}` |
| CSS 动画只播一次 | 没有 React 的 `key` 重挂载 | keyed `<Show>` 重建节点，或 `classList` 摘掉 → 回流 → 加回 |
| keyed `<Show>` 的子函数报类型错 | 类型要求子函数必须声明参数 | 写 `{(id) => …}`，用不到也写出来 |
| `textLength` / `focusable` 报类型错 | Solid 的 JSX 类型漏了这几个 SVG 属性 | `src/solid-jsx.d.ts` 模块扩充 |
| `<Show>{(x) => x.foo}</Show>` 报 x 可能为空 | callback 形式的参数是 Accessor | 写 `{(x) => x().foo}`，`x()` 已被收窄为非空 |

读到这里，回到 `frontends/react-ts` 对照同一个页面（比如创建页或收藏按钮），你会清楚看到：两边的业务逻辑几乎一样，差别只在「React 用 hooks + 重渲染 + VDOM diff」对「Solid 用 signals + owner 树 + 编译期定位」。这正是本多栈项目想让你建立的对比直觉。
