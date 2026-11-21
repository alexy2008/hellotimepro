# HelloTime Pro React + TypeScript 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 React、TypeScript、Vite、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- React、TypeScript、Vite、React Router、Zustand 与 spec/styles 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1 节介绍技术栈与设计特色；第 2～4 节建立整体地图与入口链路；第 5 节集中讲 React 的几个核心概念（组件、JSX、Hooks、单向数据流）；第 6 节快速过 TypeScript；第 7～14 节按一次「打开页面」的生命周期分层细讲；第 15 节给出常见改动的步骤清单。

## 1. 技术选型与设计特色

HelloTime Pro 的 React 前端实现基于 **React + TypeScript + Vite** 核心骨架，并选用 **React Router** 控制路由、**Zustand** 进行轻量级状态管理，样式原样引入 `spec/styles` 的两套皮肤（2.0）。其具体选型考量与设计特色如下：

* **React 与 React Router（声明式 UI 与单页体验）**：利用 React 声明式 UI 和单向数据流的优势，配合 React Router 的嵌套路由与守卫机制。用户在切换页面时无需刷新浏览器，即可获得流畅、连贯的单页应用（SPA）体验。
* **TypeScript（强类型约束与契约对齐）**：通过静态类型检查，使前端数据结构与后端的 OpenAPI 合约（`openapi.yaml`）保持高度一致。在编写代码阶段即可拦截绝大多数因字段拼写错误或未处理空值（null/undefined）导致的运行时异常。
* **Vite 构建（极速的开发与编译体验）**：基于原生 ESM 的极速热更新（HMR）特性，能实现代码改动的即时响应，大幅提升开发效率，并在生产环境下输出高度优化的静态资源。
* **Zustand（轻量且解耦的状态管理）**：避开繁重的 Redux 架构，选用极简的 Zustand 进行状态管理。其模块化单例与订阅机制既避免了 React Context 的无谓重渲染，又极易在 React 组件外部（例如 API 客户端中）同步读取和修改状态。
* **双皮肤与设计令牌（2.0）**：「时笺」「琥珀」两套皮肤 × 明暗，全部样式来自 `spec/styles`（每条规则按 `:root[data-skin]` 限定，两套同时加载）。本前端不写组件样式，只按 2.0 原型写出相同的 DOM 结构与类名；切换皮肤 / 明暗只改 `<html>` 上的两个属性。
* **逻辑一份、视图按皮肤分**：业务逻辑写成自定义 Hook（`src/hooks/`），两套皮肤的页面（`src/skins/paper`、`src/skins/amber`）都调用同一批 Hook，只负责把数据画成各自的样子——这是本前端最值得看的组织方式。



## 2. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。React 前端的职责是：

- 渲染所有页面（首页广场 / 开启 / 详情 / 创建 / 我的 / 登录 / 注册 / 关于），每个页面都有「时笺」「琥珀」两套视图。
- 调用后端 `/api/v1/*`（经 `:9080` 反代），把 JSON 画成卡片、表单、详情；2.0 新增 `/plaza/stats`、`/me/stats`。
- 维护客户端状态：登录态、皮肤与明暗、广场查询条件、创建页草稿。
- 守卫需要登录的路由（`/create`、`/me/*`），未登录跳 `/login?redirect=…`；access token 过期自动刷新并重放。

```
src/
├── main.tsx / App.tsx   入口：首帧前恢复登录态，挂路由
├── router.tsx           路由表（§7）
├── app/Layout.tsx       总布局：按皮肤挑页头 / 页脚 / 底栏
├── pages/               路由入口：读当前皮肤，渲染对应视图
├── hooks/               业务逻辑（两套皮肤共用）
├── stores/              Zustand：auth · ui · plaza · feedback
├── api/ · types/        接口客户端与类型
├── lib/                 纯工具：图标、时间说法、头像、专属色、回跳
├── components/          结构相同只靠样式换肤的部件
└── skins/paper|amber/   两套视图
```

一次「打开首页」的数据流：`pages/PlazaPage` 读 `useUi().skin` → 渲染 `skins/amber/HomePage` → 它调用 `hooks/usePlazaHome()` → Hook 调 `stores/plaza.refreshAll()` → `api/client` 发请求 → store 更新 → 视图重渲染。换成时笺时，只有视图换成 `skins/paper/HomePage`，其余链路一模一样。

## 3. 如何运行和验证

```bash
cd frontends/react-ts
./run                          # 开发模式，端口 7174
./build                        # 生产构建到 dist/
./test                         # vitest 单测
```

打开浏览器访问 `http://localhost:7174`。`./run` 做的事：

1. 检查 `node_modules` 是否存在，没有就 `npm install`。
2. 执行 `npm run dev`，即 `vite --host 0.0.0.0 --port 7174`。
3. Vite 启动一个开发服务器，按需编译 `.ts/.tsx`（用 esbuild + SWC），**修改文件自动热更新**（HMR），不需要手动刷新。

API 代理由 `vite.config.ts` 配置：所有 `/api/*` 和 `/static/*` 转发到 `BACKEND_PROXY`（默认 `http://localhost:9080`，即仓库的反向代理；可以用环境变量直连某个后端：`BACKEND_PROXY=http://localhost:29010 ./run`）。

生产构建（`./build`）：

```bash
tsc -b           # 仅做类型检查，不输出 JS
vite build       # 把 src/ 打包到 dist/（HTML + 1 个 JS bundle + CSS + 静态资源）
```

部署时把 `dist/` 放到任意静态服务器即可，但需要把 `/api/*` 反代到后端。

## 4. 入口链路：`index.html` → `main.tsx` → `App.tsx`

### 3.1 `index.html`：SPA 的唯一 HTML

```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <script>
      (function () {                          // 提早注入主题，避免首屏闪白
        try {
          var t = localStorage.getItem("hellotime.theme");
          if (t === "dark" || t === "light") {
            document.documentElement.setAttribute("data-theme", t);
          }
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- 整个应用只有一个 `<div id="root"></div>`，所有页面都在它内部渲染。这就是 SPA 的「单页」含义。
- 内联 `<script>` 在 React 启动前就同步读 localStorage，写好 `data-skin`（时笺 / 琥珀）与 `data-theme`（明 / 暗），并设置地址栏颜色——避免首帧闪出另一套皮肤或另一种明暗。
- `<script type="module" src="/src/main.tsx">`：Vite 直接把 TSX 当成 ES Module 加载（开发模式按需编译，生产模式打包成 JS）。

### 3.2 `main.tsx`：把 React 装进 `#root`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useAuth } from "@/stores/auth";
import "./styles/index.css";

// 登录态在首次渲染之前从 localStorage 恢复：守卫第一帧就能拿到正确的 user
useAuth.getState().hydrate();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- `createRoot(...)`：React 18 引入的「并发渲染」根节点 API。把一个 DOM 节点交给 React 接管。
- `<App />`：JSX 语法，表示「实例化 App 组件」。等价于 `React.createElement(App)`。
- `<StrictMode>`：开发时帮你检测潜在问题（双调用 effect、过期 API、副作用泄漏）。生产构建会自动去掉。
- `import "./styles/index.css"`：在 JS 里 import CSS 文件——这是 Vite/Webpack 等打包工具的特性，**让 CSS 也走依赖图**，不再用 `<link>`。
- `useAuth.getState().hydrate()`：在 React 之外直接读写 Zustand store。放在 `createRoot` 之前，是为了让「已登录访问 /register 就跳走」这类守卫在第一帧就判断正确。

### 3.3 `App.tsx`：根组件 + 启动副作用

```tsx
export function App() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const refreshMe = useAuth((s) => s.refreshMe);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);

  // 皮肤与明暗在 index.html 的内联脚本里已经写好（首帧之前），这里只恢复登录态
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (hydrated && refreshToken) {
      void refreshMe();
    }
  }, [hydrated, refreshToken, refreshMe]);

  return <RouterProvider router={router} />;
}
```

做的事：

1. 从 Zustand store 读出几个函数和状态（第 5 节会讲选择器）。
2. **首次挂载时**再调一次 `hydrate()`（幂等）；皮肤与明暗不需要在这里处理。
3. 一旦 `hydrated && refreshToken` 都齐了，主动调一次 `/me` 验证登录态。
4. 渲染路由提供者 `<RouterProvider router={router} />`，把 URL 控制权交给 React Router。

后面再讲 `useAuth((s) => s.hydrate)` 这种「Zustand 选择器」的语法。

## 5. React 的核心概念

React 没有「魔法」，但有 **四个核心概念** 是 HTML/JS 老兵第一次写 React 时最容易困惑的地方。看懂它们，剩下都是 JS 语法。

### 4.1 组件 = 返回 JSX 的函数

```tsx
export function PaperFooter() {
  return <footer>© 2026 HelloTime</footer>;
}
```

- 一个组件就是一个**大写字母开头**的 JavaScript 函数，返回值是 JSX。
- 「调用」组件用 `<PaperFooter />` 而不是 `PaperFooter()`——这是给 React 看的标记，让它把你的函数纳入虚拟 DOM 树。
- 大写开头很重要：`<div>` 是 HTML 标签，`<Div>` 是你定义的组件。

### 4.2 JSX = HTML-in-JS

JSX 看起来像 HTML，但实际是 JS 的语法糖：

| HTML | JSX | 原因 |
|---|---|---|
| `class="foo"` | `className="foo"` | `class` 是 JS 保留字 |
| `for="x"` | `htmlFor="x"` | `for` 是 JS 保留字 |
| `onclick="..."` | `onClick={fn}` | 大括号嵌入表达式，传函数引用 |
| `style="color: red"` | `style={{ color: "red" }}` | 嵌一个 JS 对象 |
| 文本插值 | `{user.nickname}` | 大括号里是任意 JS 表达式 |

JSX 必须**只有一个根节点**，多个并列时用 `<>...</>` Fragment 包起来：

```tsx
return (
  <>
    <Header />
    <Outlet />
    <Footer />
  </>
);
```

条件渲染、列表渲染都是普通 JS：

```tsx
{user ? <UserChip /> : <LoginBtn />}              // 三元
{user && <Welcome />}                              // 短路
{items.map((c) => <PaperCard key={c.id} c={c} now={now} />)}  // map
```

`key` prop 告诉 React 列表里每项的身份，diff 时知道哪些是同一个元素。**永远用稳定 ID，不要用 index**。

### 4.3 Props = 函数参数；State = 函数内的「记忆」

**单向数据流**：父组件通过 props 把数据往下传，子组件不能反向修改父的 props。要让子组件影响父，传一个回调函数下去。

```tsx
// 子
function FavoriteButton({ capsule, onChange }: Props) { ... onChange?.(true, count); }
// 父
<FavoriteButton capsule={c} onChange={(fav, n) => console.log(fav, n)} />
```

**State** 是组件内可变的「记忆」，必须用 `useState` 创建：

```tsx
const [email, setEmail] = useState("");          // 初始空字符串
<input value={email} onChange={(e) => setEmail(e.target.value)} />
```

为什么不能直接 `let email = ""`？因为函数组件每次渲染都会从头执行一遍——`let` 每次都会被重置。`useState` 让 React 在组件实例之外帮你保留值，并在 `setEmail(...)` 时**触发重新渲染**。

> **核心心智模型**：UI = f(state)。你描述「当前状态对应的 UI 长什么样」，React 负责把它真的渲染到 DOM。你永远不直接 `document.getElementById(...).innerText = ...`。

### 4.4 Hooks：在函数组件里「钩入」框架能力

`useState` 是「Hook」之一。Hook 是以 `use` 开头的特殊函数，**只能在组件函数的顶层调用，不能在 if/for 里**（React 靠调用顺序辨认它们）。本项目用到的：

| Hook | 作用 | 例子 |
|---|---|---|
| `useState` | 局部状态 | `const [busy, setBusy] = useState(false)` |
| `useEffect` | 副作用（fetch、订阅、定时器） | `useEffect(() => { fetch(...); }, [deps])` |
| `useRef` | 跨渲染保留的可变容器 | `const menuRef = useRef<HTMLDivElement>(null)` |
| `useMemo` | 昂贵计算缓存 | `const contentLen = useMemo(() => content.length, [content])` |
| `useNavigate` (router) | 编程式跳转 | `const navigate = useNavigate(); navigate("/login")` |
| `useLocation` (router) | 读当前 URL | `const location = useLocation()` |
| `useAuth`、`usePlaza` 等 | 自定义 Hook（Zustand store） | `const user = useAuth((s) => s.user)` |

#### `useEffect` 的依赖数组

```tsx
useEffect(() => {
  if (opened) return;
  const t = window.setInterval(() => setTick((x) => x + 1), 1000);
  return () => window.clearInterval(t);     // 清理函数：卸载或依赖变化时调用
}, [opened]);
```

- 第二个参数是依赖数组：`[opened]` 表示「`opened` 变化时重新跑」。`[]` 表示「只跑一次」，省略表示「每次渲染都跑」。
- 返回的函数是「清理」：当依赖变化或组件卸载时调用，用于解绑定时器、取消订阅，避免内存泄漏。

#### 函数式更新：避免闭包陷阱

```tsx
setInterval(() => setTick((x) => x + 1), 1000);   // ✅ 传函数，拿到最新值
setInterval(() => setTick(tick + 1), 1000);       // ❌ tick 永远是 effect 那次的初值
```

这是 React 里最常踩的坑之一：`setInterval` 回调里 `tick` 是创建 effect 时的快照。永远传更新函数，让 React 帮你拿当前值。

## 6. TypeScript 快速概览

`.ts` 与 `.tsx` 文件本质是带类型注解的 JavaScript。Vite/编译器会把它们去掉类型转成 JS。读代码时几乎可以「把冒号后面的内容当注释」忽略。

```ts
interface User { id: string; email: string; nickname: string; avatarId: string; createdAt: string; }
function shortName(name: string): string { ... }
type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | ...;   // 联合类型，只能是其中之一
export type Theme = "dark" | "light";
```

几个本项目里频繁出现的写法：

```ts
const user: User | null = ...;            // 联合类型，可能为 null
function load(): PersistShape | null { ... }
useState<string | null>(null)             // 泛型参数，强制状态是 string 或 null
Pick<CapsuleListItem, "id" | "favoritedByMe">  // 工具类型，从 CapsuleListItem 摘出指定字段
e as Error                                // 类型断言，告诉 TS「我确定它是 Error」
e instanceof ApiError                     // 运行时类型检查，TS 会窄化类型
```

> 类型的价值：编辑器自动补全；编译时发现「字段拼错」「忘了处理 null」等错误。**类型不影响运行行为**，去掉类型后 JS 行为不变。

`tsconfig.app.json` 里开了 `strict: true`，所以 null 必须显式处理。生产构建第一步就是 `tsc -b` 跑类型检查——类型错的代码无法构建。

## 7. 路由层：`router.tsx`

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";

export const router = createBrowserRouter([
  {
    element: <Layout />,                           // 总布局：按皮肤挑页头 / 页脚 / 底栏
    children: [
      { path: "/", element: <PlazaPage /> },
      { path: "/open", element: <OpenPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/create", element: gated(<CreatePage />) },
      { path: "/capsules/:code", element: <CapsuleByCodePage /> },
      { path: "/me", element: <Navigate to="/me/created" replace /> },
      { path: "/me/:tab", element: gated(<MePage />) },   // 三个页签共用一个页面组件
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
```

要点：

- **嵌套路由 + Layout**：父对象只给 `element` 而没有 `path`，子路由的页面会渲染到父布局的 `<Outlet />` 占位里。`Layout` 就是「头 + Outlet + 尾」的壳。
- **路径参数**：`/capsules/:code` 里 `:code` 在页面组件里用 `useParams()` 取出；`/me/:tab` 让三个页签共用一个组件，切页签时页头与统计不重新挂载。
- **重定向**：`<Navigate to="/me/created" replace />` 渲染时立即换 URL；`replace` 表示不留下历史记录。
- **路由守卫**：`<AuthGate>` 是普通组件，未登录就 `<Navigate to="/login?redirect=…" />`，否则渲染 `children`。详见 7.2。
- **404 兜底**：`path: "*"` 匹配任意 URL，放在数组末尾。

页面之间的跳转用：

```tsx
<Link to="/login">登录</Link>                       // 渲染成 <a>，但点击拦截走前端路由
<NavLink to="/" className={({ isActive }) => ...}>  // 知道自己是否高亮的 Link
const navigate = useNavigate();                     // 编程式
navigate("/me/created", { replace: true });
```

它们都**不刷新页面**——浏览器地址栏变了，React 重新渲染对应的页面组件而已。

## 8. 关键模式：守卫与布局

### 7.1 `app/Layout.tsx`：按皮肤挑外壳

所有路由挂在同一个 `<Layout />` 下。它读 `useUi((s) => s.skin)`，从一张表里挑出这套皮肤的 `Header / Footer / TabBar`，中间是 `<main id="view"><Outlet /></main>`。`id="view"`、`body[data-route]` 都是 `spec/styles` 依赖的 DOM 约定，照原型写；「时笺」用到的 SVG 滤镜（`#f-rough`、`#f-ink`）与「琥珀」的星空背景也在这里挂一次。

### 7.2 `AuthGate.tsx`：路由守卫

```tsx
export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);
  const location = useLocation();

  if (!hydrated) return null;                                // 等 localStorage 读完
  if (user || refreshToken) return <>{children}</>;          // 已登录或可静默续期
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
```

- `children` 是 React 内置 prop：被 `<AuthGate>...</AuthGate>` 包裹的内容会作为它传进来。
- 守卫的精妙之处：只有 `refreshToken` 也允许进入——因为接下来的 API 调用会自动 refresh（见 §9.2），用户看不到打断。
- 把当前 URL 塞到导航 state，登录后 `LoginPage` 读出并回跳，体验更好。

## 9. 数据层：`api/client.ts`

### 8.1 通用 `request<T>(path, opts)`

```ts
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ... };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const accessToken = await accessTokenForRequest(useAuth);
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const env = (await res.json()) as Envelope<T>;
  if (!res.ok || !env.success) {
    if (shouldTryRefresh(res, env, useAuth, opts._retry)) {
      const newAt = await tryRefresh();
      if (newAt) return request<T>(path, { ...opts, _retry: true });
    }
    throw new ApiError(env.message ?? "请求失败", res.status, env.errorCode, env.details);
  }
  return env.data as T;
}
```

做的事：

1. 自动设置 `Content-Type` 和 `Accept`、自动序列化 `body`、自动拼 `Authorization` 头。
2. 解开后端的统一外壳 `{ success, data, message, errorCode }`，**调用者只看到 `data`**。
3. 失败时抛 `ApiError`，带上 HTTP 状态、errorCode、字段级 details。
4. **泛型 `<T>`**：`api.plaza()` 返回 `Promise<PaginatedCapsules>`，TS 全程帮你检查字段名拼写。

### 8.2 自动 refresh：去重 + 重放

```ts
let refreshing: Promise<string | null> | null = null;
async function tryRefresh() {
  if (refreshing) return refreshing;            // 并发请求都拿到同一个 Promise
  refreshing = (async () => { ...POST /auth/refresh... })();
  return refreshing;
}
```

模块级单例变量 `refreshing`：当一波 401 同时发生时（比如同时调了 3 个接口），只发一次 refresh 请求，其他人 `await` 同一个 Promise。

整体流程：

```text
fetch → 401 + UNAUTHORIZED → tryRefresh()
                                ├── 拿到新 accessToken → 重放原请求
                                └── refresh 也失败 → onAuthLost() 清状态
```

`_retry` 标记防止「refresh 后重放又 401」陷入无限循环。

### 8.3 与 store 解耦：`configureApi(...)`

注意 `api/client.ts` 没有 `import { useAuth }`！原因是 `stores/auth.ts` 反过来 import 了 `api`，会形成循环。解法是「依赖注入」：

```ts
// api/client.ts
let getAccessToken: () => string | null = () => null;
export function configureApi(opts: {...}) { getAccessToken = opts.getAccessToken; ... }

// stores/auth.ts
configureApi({
  getAccessToken: () => useAuth.getState().accessToken,
  ...
});
```

`stores/auth.ts` 模块被加载时立即调用一次，把 store 的 getter 注册给 client。之后 client 拿 token 都走这些函数。

## 10. 状态层：Zustand

[Zustand](https://github.com/pmndrs/zustand) 是个极简状态管理库。比起 Redux，它几乎没有样板代码。

### 9.1 创建 store

```ts
export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  hydrate: () => { ... set({ user: ..., hydrated: true }); },
  setTokens: (t) => { set({ user: t.user, ... }); persist(...); },
  ...
}));
```

`create(...)` 接受一个函数，返回 `(set, get)` 两个工具：

- `set(partial)`：浅合并到当前 state，触发订阅者重渲染。
- `get()`：读当前 state（同步）。

`useAuth` 本身是一个**自定义 Hook**：在组件里这样用：

```tsx
const user = useAuth((s) => s.user);              // 选择器：只关心 user 字段
const logout = useAuth((s) => s.logout);          // 取一个动作函数
```

「选择器」很重要：组件只在 `s.user` 变化时重渲染，`s.theme` 变了不会触发。**选越细，性能越好**。

也能在组件之外读 / 调：

```ts
useAuth.getState().accessToken                    // 同步读
useAuth.setState({ user: null })                  // 直接改
```

### 9.2 本项目的四个 store

| Store | 关心什么 | 持久化 |
|---|---|---|
| `useAuth` | user / accessToken / refreshToken / hydrated | refreshToken + user → localStorage（`main.tsx` 在首次渲染前恢复） |
| `useUi` | skin（paper / amber）· theme（light / dark）及带转场的切换 | localStorage `hellotime.skin` / `hellotime.theme` |
| `usePlaza` | sort / filter / q / page + 列表、筛选数量、年鉴、精选 | 否；但两套皮肤共用，切换皮肤后条件还在 |
| `useFeedback` | Toast 队列与当前确认框 | 否；页面里直接调 `toast()`、`await confirmDialog()` |

创建页草稿是 `hooks/useCreateCapsule.ts` 里的一个小 store（`useDraft`），只在内存里，切换皮肤、离开再回来都还在；封存成功、登出、换了账号时清空——草稿属于写它的人（订阅 `useAuth`，`user.id` 变了就 `reset()`）。

登录 / 注册 / 资料 / 改密码的表单值同理放在 `hooks/useAccount.tsx` 的 `useForms` 里：切换皮肤会把视图组件整个换掉，值若放在组件的 `useState` 里就丢了（违反 X5）。它们在提交成功、登出、**离开该页面**时清空——判断「离开」的办法是卸载时看地址栏：切皮肤时路由没变，真离开时路由已经变了。

### 9.3 一致性：跨 store 联动

`FavButton` 收藏成功后直接调 `usePlaza.getState().patchFavorited(...)` 更新广场列表与精选里的这一枚；「我收藏的」里取消收藏则通过回调把它从列表移出、并刷新 `/me/stats`。

### 9.4 并发请求的「序列号」模式

```ts
let fetchSeq = 0;
fetch: async () => {
  const myId = ++fetchSeq;
  set({ loading: true });
  const data = await api.plaza({...});
  if (myId !== fetchSeq) return;       // 我已经被新请求淘汰了
  set({ items: data.items, ... });
}
```

用户快速切 sort/filter 时会连发好几个请求，网络响应顺序不一定和发起顺序一致。`fetchSeq` 保证「只有最后发起的那个请求才能写状态」，避免老结果覆盖新结果。

## 11. 页面层、Hook 层与皮肤视图

### 10.1 一个页面的三层

```tsx
// pages/CreatePage.tsx：CreatePage 按 user.id 挂载 CreateForm
function CreateForm() {
  const skin = useUi((s) => s.skin);
  const f = useCreateCapsule();
  return skin === "paper" ? <PaperCreatePage f={f} /> : <AmberCreatePage f={f} />;
}
```

`CreateForm` 在当前账号的创建路由上持有提交锁、AI 任务和成功回执。切皮肤只替换子视图，因此正在封存的请求仍由同一实例接收。请求成功后先核对草稿快照，才能清空已提交的内容；等待期间编辑的新草稿会保留。

### 10.2 表单：受控组件

所有输入都是受控组件：值放在 Hook / store 里，`onChange` 写回去。`components/forms.tsx` 的 `Field` 按当前皮肤出不同外框（时笺是下划线信笺栏，琥珀是带图标的输入框），出错时自带 `field-error` 测试钩子并抖一下。

### 10.3 组件分类

| 位置 | 放什么 |
|---|---|
| `components/` | 结构两套相同的部件：`Seg`（分段控件）、`FavButton`、`LoginPrompt`（匿名收藏 / 创建先确认再去登录、`CreateLink`）、`Feedback`（Toast / 确认框）、`forms`、`shared`（头像、技术栈、皮肤开关、「加载更多」）、`AuthGate` |
| `skins/<skin>/parts.tsx` | 皮肤专属的小件：时笺的印章、火漆、信封、邮戳、翻页数字；琥珀的胶囊插画、徽标、翻牌倒计时 |
| `skins/<skin>/*Page.tsx` | 页面视图与卡片、外壳 |

### 10.4 测试钩子

每个关键元素都带 `spec/ui/testids.md` 规定的 `data-testid` 与状态属性（`data-state`、`data-code`、`aria-pressed`…）。UI 冒烟只靠它们定位，所以两套皮肤可以跑同一套用例。新增元素时先查契约。

## 12. 工具层：`lib/`

| 文件 | 内容 |
|---|---|
| `fmt.ts` | 时间说法（`span`：「2 年 8 个月」）、倒计时拆分、等待进度、农历、`reducedMotion()`、`focusIfIdle()`、`addCalendarYears()`（开启时间上限：10 个日历年，与服务端同一算法） |
| `icons.tsx` | 24 网格线性图标 |
| `avatars.ts` | 构建期内联 `spec/avatars/v2` 的单线徽记（`import.meta.glob(..., { query: "?raw" })`） |
| `palette.ts` | 琥珀的胶囊专属色：FNV-1a + OKLCH（`docs/02-design.md §9.6`） |
| `about.ts` | 关于页共用文字 |
| `redirect.ts` | 登录回跳：只接受站内路径 |

## 13. 样式层：spec/styles

`src/styles/index.css` 只做三件事：引入 `@fontsource` 自托管字体；按「base → 时笺 → 琥珀 → shell」的顺序引入 `spec/styles`；引入 `app.css`（一行：让 `#root` 不参与布局）。本前端不写组件样式，也不用 Tailwind。

想改长相：改 `spec/styles/<skin>/*.css`（所有实现一起受益），并在原型里两套皮肤、明暗都看一遍。想加只属于本前端的胶水样式：写进 `app.css`，只能用 `base.css` 刻度与语义令牌（`--color-*` 等）。

## 14. 测试

- 单元测试（vitest，`./test`）：`lib/lib.test.ts` 测时间说法、专属色确定性、登录回跳；`api/client.test.ts` 测 refresh 单飞与重放。
- UI 冒烟（Playwright，`verification/ui`）：44 条用例 × 两套皮肤，靠测试钩子定位；`SKINS=paper` 可只跑一套。

## 15. 常见改动指南

- **新增一个页面**：在 `hooks/` 写逻辑 → 在 `skins/paper` 与 `skins/amber` 各写一份视图（照原型的结构与类名）→ 在 `pages/` 加一个按皮肤分发的入口 → 在 `router.tsx` 登记 → 按 `spec/ui/testids.md` 加测试钩子。
- **新增一个接口**：先改 `spec/api/openapi.yaml` → 在 `types/` 加类型 → 在 `api/client.ts` 加方法 → 在 Hook 里调用。
- **调整视觉**：改 `spec/styles`，不要在组件里写样式。

## 16. 学到这里之后

读到这里，你已经掌握了现代 React SPA 最常见的 80%：JSX、组件、props/state、Hooks（特别是 `useState/useEffect`）、React Router、Zustand、TypeScript 类型注解、Vite 入口与代理、fetch 封装 + 自动 refresh、CSS 变量主题。

下一步建议：

- 翻 `src/pages/CreatePage.tsx`（最复杂的页面），跟读「填表单 → 调 AI 建议 → 提交 → 跳详情」整条路径。
- 在 `usePlaza.fetch` 加 `console.log`，切换 sort/filter 观察「序列号丢弃旧请求」的行为。
- 比较一下 `frontends/vue3-ts` 或 `frontends/angular` 的同名页面，理解相同 UI 在 Vue Composition API / Angular Signals 下怎么写——这是这个项目最大的价值。

之后可以再深入研究 React 的几个常见进阶主题：`useReducer` 与 Context API（不用第三方库的状态管理）、`Suspense` + 数据获取、React Server Components、性能优化的 `useMemo / useCallback / React.memo` 三件套、Testing Library 的组件测试。本项目刻意保持极简，把这些留给后续。
