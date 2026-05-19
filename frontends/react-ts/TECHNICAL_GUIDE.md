# HelloTime Pro React + TypeScript 前端技术手册与代码导读

本文面向已经熟悉 HTML / CSS / JavaScript 基本语法，但还没系统接触过 React、TypeScript、Vite、单页应用（SPA）这套现代前端栈的读者。读完后，你应该能回答三件事：

- 用户在浏览器输入 URL 后，代码按什么顺序执行。
- React、TypeScript、Vite、React Router、Zustand、Tailwind 分别在做什么。
- 想新增一个页面、状态或接口调用时，应该改哪些文件。

> 阅读建议：第 1～3 节先建立整体地图；第 4 节集中讲 React 的几个核心概念（组件、JSX、Hooks、单向数据流）；第 5 节快速过 TypeScript；第 6～13 节按一次「打开页面」的生命周期分层细讲；第 14 节给出常见改动的步骤清单。

## 1. 先建立整体地图

HelloTime Pro 是一个时间胶囊应用。React 前端的职责是：

- 渲染所有 UI 页面（广场 / 开启 / 创建 / 我的 / 登录 / 注册 / 关于）。
- 通过 HTTP 调用后端 `/api/v1/*` 接口，把 JSON 渲染成卡片、表单、详情。
- 维护客户端状态：登录态、主题（暗/亮）、广场筛选条件、我创建的 / 收藏的列表。
- 守卫需要登录的路由（`/create`、`/me/*`），自动用 refresh token 续期 access token。
- 跑在浏览器里，是一个 **单页应用**（SPA）：所有跳转都不刷新页面，由 JS 重新渲染。

核心目录：

```text
frontends/react-ts/
├── index.html                  # SPA 唯一的 HTML 文件，里面只有一个 <div id="root"></div>
├── vite.config.ts              # Vite 配置：dev server、API 代理、路径别名
├── package.json                # 依赖与 npm 脚本
├── tsconfig*.json              # TypeScript 编译配置
├── run / build / test          # 三个 Bash 脚本，封装 npm 命令
└── src/
    ├── main.tsx                # 入口：createRoot(document.getElementById("root")) + 渲染 <App />
    ├── App.tsx                 # 应用根：hydrate auth/theme + 注入路由
    ├── router.tsx              # 路由表：URL → 页面组件 + 守卫
    ├── styles/                 # 全局样式入口（导入 spec/styles 的设计令牌）
    ├── types/index.ts          # 与后端 spec/api/openapi.yaml 对齐的 TypeScript 类型
    ├── api/client.ts           # fetch 封装 + 解响应包装 + 自动 refresh
    ├── stores/                 # Zustand：auth · theme · plaza · capsule（四个状态域）
    ├── utils/                  # 倒计时 / 时间格式化 / 头像 URL（纯函数）
    ├── components/             # 可复用的 UI 组件（AppHeader、CapsuleCard、Alert…）
    └── pages/                  # 路由对应的页面组件（一个路由一个文件）
```

一次「打开广场页」的流向：

```text
浏览器
  │ GET /
  ▼
Vite dev server (开发) / 静态文件 (生产)
  │ 返回 index.html
  ▼
浏览器解析 HTML → 加载 /src/main.tsx
  │ ESM 动态加载所有 import 的模块
  ▼
main.tsx: createRoot(...).render(<App />)
  │ React 把虚拟 DOM 挂到 #root
  ▼
App.tsx
  │ useEffect 调 useAuth.hydrate() / useTheme.hydrate()
  │ 渲染 <RouterProvider router={router} />
  ▼
router.tsx 按 URL 匹配 → <MainLayout><PlazaPage /></MainLayout>
  │
  ▼
PlazaPage 的 useEffect 调 usePlaza.fetch()
  │
  ▼
api.plaza({...}) → fetch("/api/v1/plaza/capsules")
  │ Vite dev server 反代到 :9080
  ▼
后端返回 JSON → Zustand store 更新 → React 重渲染卡片列表
```

返回方向上完全相反：用户点收藏按钮 → `FavoriteButton.onClick` → `api.favorite(id)` → 收到新计数 → `setActive / setCount / patchPlaza` → 触发 React 重渲染。**只有状态变更会触发渲染，没有人手动操作 DOM**——这是 React 和原生 JS 写法最大的差别。

## 2. 如何运行和验证

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

## 3. 入口链路：`index.html` → `main.tsx` → `App.tsx`

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
- 内联 `<script>` 在 React 启动前就同步读 localStorage 设置 `data-theme`——避免 React 渲染前看到 dark 闪到 light 的「主题闪白」。
- `<script type="module" src="/src/main.tsx">`：Vite 直接把 TSX 当成 ES Module 加载（开发模式按需编译，生产模式打包成 JS）。

### 3.2 `main.tsx`：把 React 装进 `#root`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/index.css";

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

### 3.3 `App.tsx`：根组件 + 启动副作用

```tsx
export function App() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const refreshMe = useAuth((s) => s.refreshMe);
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);
  const hydrateTheme = useTheme((s) => s.hydrate);

  useEffect(() => {
    hydrateTheme();
    hydrateAuth();
  }, [hydrateAuth, hydrateTheme]);

  useEffect(() => {
    if (hydrated && refreshToken) {
      void refreshMe();
    }
  }, [hydrated, refreshToken, refreshMe]);

  return <RouterProvider router={router} />;
}
```

做的事：

1. 从 Zustand store 读出几个函数和状态（第 4 节会讲选择器）。
2. **首次挂载时**（`useEffect` + 空依赖等效）调 `hydrate()` 把 localStorage 里持久化的主题和登录态读进内存。
3. 一旦 `hydrated && refreshToken` 都齐了，主动调一次 `/me` 验证登录态。
4. 渲染路由提供者 `<RouterProvider router={router} />`，把 URL 控制权交给 React Router。

后面再讲 `useAuth((s) => s.hydrate)` 这种「Zustand 选择器」的语法。

## 4. React 的核心概念

React 没有「魔法」，但有 **四个核心概念** 是 HTML/JS 老兵第一次写 React 时最容易困惑的地方。看懂它们，剩下都是 JS 语法。

### 4.1 组件 = 返回 JSX 的函数

```tsx
export function AppFooter() {
  return <footer>© 2026 HelloTime</footer>;
}
```

- 一个组件就是一个**大写字母开头**的 JavaScript 函数，返回值是 JSX。
- 「调用」组件用 `<AppFooter />` 而不是 `AppFooter()`——这是给 React 看的标记，让它把你的函数纳入虚拟 DOM 树。
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
    <AppHeader />
    <Outlet />
    <AppFooter />
  </>
);
```

条件渲染、列表渲染都是普通 JS：

```tsx
{user ? <UserChip /> : <LoginBtn />}              // 三元
{user && <Welcome />}                              // 短路
{items.map((c) => <CapsuleCard key={c.id} capsule={c} />)}  // map
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

## 5. TypeScript 快速概览

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

## 6. 路由层：`router.tsx`

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";

export const router = createBrowserRouter([
  {
    element: <MainLayout />,                       // 公共布局：Header + Outlet + Footer
    children: [
      { path: "/", element: <PlazaPage /> },
      { path: "/open", element: <OpenPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/create", element: <AuthGate><CreatePage /></AuthGate> },
      { path: "/c/:code", element: <CapsuleByCodePage /> },
    ],
  },
  {
    element: <AuthGate><MeLayout /></AuthGate>,
    children: [
      { path: "/me", element: <Navigate to="/me/created" replace /> },
      { path: "/me/created", element: <MeCreatedPage /> },
      ...
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
```

要点：

- **嵌套路由 + Layout**：父对象只给 `element` 而没有 `path`，子路由的页面会渲染到父布局的 `<Outlet />` 占位里。`MainLayout` 就是「头 + Outlet + 尾」的壳。
- **路径参数**：`/c/:code` 里 `:code` 在页面组件里用 `useParams<{ code: string }>()` 取出。
- **重定向**：`<Navigate to="/me/created" replace />` 渲染时立即换 URL；`replace` 表示不留下历史记录。
- **路由守卫**：`<AuthGate>` 是普通组件，未登录就 `<Navigate to="/login" .../>`，否则渲染 `children`。详见 7.2。
- **404 兜底**：`path: "*"` 匹配任意 URL，放在数组末尾。

页面之间的跳转用：

```tsx
<Link to="/login">登录</Link>                       // 渲染成 <a>，但点击拦截走前端路由
<NavLink to="/" className={({ isActive }) => ...}>  // 知道自己是否高亮的 Link
const navigate = useNavigate();                     // 编程式
navigate("/me/created", { replace: true });
```

它们都**不刷新页面**——浏览器地址栏变了，React 重新渲染对应的页面组件而已。

## 7. 关键模式：守卫与布局

### 7.1 `MainLayout.tsx` / `MeLayout.tsx`：共享外壳

```tsx
export function MainLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />          // 子路由的页面组件渲染在这里
      <AppFooter />
    </>
  );
}
```

`<Outlet />` 是 React Router 的占位组件，由当前匹配的子路由的 `element` 替换。这样所有顶层页面共享同一个头/尾，URL 切换时只重渲染 Outlet 内部，Header 状态保留。

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
- 守卫的精妙之处：只有 `refreshToken` 也允许进入——因为接下来的 API 调用会自动 refresh（见 §8.2），用户看不到打断。
- 把当前 URL 塞到导航 state，登录后 `LoginPage` 读出并回跳，体验更好。

## 8. 数据层：`api/client.ts`

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

## 9. 状态层：Zustand

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
| `useAuth` | user / accessToken / refreshToken / hydrated | refreshToken + user → localStorage |
| `useTheme` | "dark" / "light" | localStorage `hellotime.theme` |
| `usePlaza` | sort / filter / q / page + items / pagination / loading | 否（每次进页面重新拉） |
| `useCapsule` | mine / favorites 两个分页列表 | 否 |

### 9.3 一致性：跨 store 联动

`useCapsule.toggleFavorite` 收藏成功后，同时**直接调** `usePlaza.getState().patchFavorited(...)` 更新广场列表里这条胶囊的 `favoritedByMe / favoriteCount`。这样从「我收藏的」列表里取消，再切回广场，那一条不会显示成已收藏。

```ts
usePlaza.getState().patchFavorited(capsuleId, true, result.favoriteCount);
```

> Zustand store 是模块级单例，多个 store 互相 `import` 并不会破坏 React 渲染，因为 `.getState()` 是同步读，不通过 React 订阅。这是 Zustand 比 React Context 更灵活的地方之一。

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

## 10. 页面层与组件层

### 10.1 一个页面的典型骨架

```tsx
export function PlazaPage() {
  const fetchPlaza = usePlaza((s) => s.fetch);
  const items = usePlaza((s) => s.items);
  const loading = usePlaza((s) => s.loading);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    if (hydrated) void fetchPlaza();              // 等鉴权 ready 再拉，避免 favoritedByMe 不一致
  }, [hydrated, fetchPlaza]);

  return (
    <>
      <section className="cy-hero-block">...</section>
      <main className="cy-container">
        <PlazaToolbar />
        <CapsuleGrid items={items} loading={loading} ... />
        <Pagination ... />
      </main>
    </>
  );
}
```

模式：

- 顶部从 store 取出需要的状态和动作。
- `useEffect` 触发首次 fetch。
- 返回的 JSX 直接消费状态，没有手动 DOM 操作。
- 子组件只通过 props 传值，不直接读 store（让组件可复用）——但 `PlazaToolbar` 这种「天然只服务于一个 store」的组件会直接读，省去 prop drilling。

### 10.2 表单：受控组件

```tsx
const [email, setEmail] = useState("");
<input value={email} onChange={(e) => setEmail(e.target.value)} />
```

每个输入框的值都来自 state，每次按键都触发 state 更新与重渲染。这种「受控组件」让你能随时校验、格式化、清空，比直接读 DOM 更可预测。

提交：

```tsx
async function submit(e: FormEvent) {
  e.preventDefault();
  setBusy(true);
  try {
    const tokens = await api.login({ email: email.trim(), password });
    setTokens(tokens);
    navigate(state?.from ?? "/me/created", { replace: true });
  } catch (e) {
    setErr(e instanceof ApiError ? e.message : "登录失败");
  } finally {
    setBusy(false);
  }
}
```

`e.preventDefault()` 阻止浏览器默认的「整页 POST」。

### 10.3 组件分类

| 类型 | 举例 | 特征 |
|---|---|---|
| **布局** | `MainLayout`、`MeLayout` | 套在路由外层，含 Header/Footer/`<Outlet />` |
| **展示** | `CapsuleCard`、`Alert`、`Pagination` | 只接受 props，几乎无 state |
| **交互** | `FavoriteButton`、`PlazaToolbar`、`AvatarPicker` | 有内部 state + 副作用 |
| **守卫** | `AuthGate` | 包住 children，根据条件 render 或重定向 |

## 11. 工具层：`utils/format.ts` 等

纯函数，没有 React 依赖，可以直接 import 用：

```ts
countdownTo(iso)               // 返回 { days, hours, minutes, seconds, expired }
fmtDateTime(iso)               // 本地化日期时间字符串
localInputToIso(local)         // <input type="datetime-local"> 值 → ISO UTC
isoToLocalInput(iso)           // 反向
avatarUrl(avatarId)            // → "/static/avatars/<id>.svg"
```

`CapsuleCard` 里的倒计时模式值得记：

```tsx
const [, setTick] = useState(0);
useEffect(() => {
  if (opened) return;
  const t = window.setInterval(() => setTick((x) => x + 1), 1000);
  return () => window.clearInterval(t);
}, [opened]);
const cd = countdownTo(capsule.openAt);            // 每次渲染重算
```

`setTick` 仅用于强制重渲染，**值本身不展示**。计算放在渲染期，`useEffect` 只管定时触发。已开启的胶囊提早 `return`，永不创建 interval——避免列表里几十个卡片都在跑无用定时器。

## 12. 样式层：Tailwind + 设计令牌

```css
/* src/styles/index.css */
@import "tailwindcss";
@import "../../../../spec/styles/palette.css";    /* 色阶变量 --brand-500 等 */
@import "../../../../spec/styles/tokens.css";     /* 语义令牌 --color-text-primary 等 */
@import "../../../../spec/styles/cyber.css";      /* 共享类 cy-btn / cy-card / cy-capsule */
@import "./layout.css";
```

- `spec/styles/tokens.css` 是 **设计系统的单一来源**。所有前端实现（React / Vue / Angular / Svelte / Solid）共用同一份。修改设计 token 一次，五个前端都生效。
- 主题切换靠 `data-theme="dark" | "light"`：tokens.css 里用 `[data-theme="dark"] { --color-text-primary: ... }` 重写变量。这就是为什么 `index.html` 内联脚本要尽早设置这个属性。
- 组件用 **`cy-*` 共享类**（如 `cy-btn cy-btn--primary`），底层是 CSS 变量。**不允许直接写 `color: #ff00aa` 或用色阶变量 `--brand-500`**——这是为了保证多前端实现的视觉一致和暗/亮主题正常切换。
- Tailwind v4 通过 `@tailwindcss/vite` 插件接入，主要用 utility 类做微调（间距、对齐）。
- 内联 `style={{ ... }}` 仅用于一次性、与 token 无关的微调（比如某个卡片的 max-width）。

## 13. 测试：vitest

```bash
./test
```

跑的是 `*.test.ts(x)` 文件。本项目目前有 `api/client.test.ts` 和 `utils/format.test.ts`，验证 fetch 拦截、解包、倒计时计算。组件测试需要 jsdom + React Testing Library，本项目（教学版）没有引入。

## 14. 常见改动指南

| 想做什么 | 改哪里 |
|---|---|
| 加一个新页面 | ① `src/pages/XxxPage.tsx` 导出组件；② `src/router.tsx` 加 `{ path, element }` |
| 加一个登录后才能访问的页面 | 同上，但 `element` 包一层 `<AuthGate>...</AuthGate>` |
| 加一个 API 端点 | ① `src/types/index.ts` 加请求/响应类型；② `src/api/client.ts` 在 `api` 对象里加方法 |
| 加一个状态域 | `src/stores/xxx.ts` 用 `create` 定义一个新 store，并在用到的页面里 `useXxx(...)` |
| 加一个可复用 UI | `src/components/Xxx.tsx` 写一个组件，接受 props |
| 加一个全局样式 | 优先到 `spec/styles/cyber.css` 加 `cy-*` 类；只服务本前端的局部样式放 `src/styles/layout.css` |
| 加一个表单字段 | 在页面组件里加 `useState` + `<input value onChange>` + 提交处理 |
| 改 API 代理目标 | `BACKEND_PROXY=http://localhost:29010 ./run` |
| 改主题色 / 间距 | 修改 `spec/styles/tokens.css` 的 CSS 变量，所有前端同步生效 |
| 想在组件外读 store | `useStore.getState()` / `useStore.setState({...})` |

## 15. 学到这里之后

读到这里，你已经掌握了现代 React SPA 最常见的 80%：JSX、组件、props/state、Hooks（特别是 `useState/useEffect`）、React Router、Zustand、TypeScript 类型注解、Vite 入口与代理、fetch 封装 + 自动 refresh、CSS 变量主题。

下一步建议：

- 翻 `src/pages/CreatePage.tsx`（最复杂的页面），跟读「填表单 → 调 AI 建议 → 提交 → 跳详情」整条路径。
- 在 `usePlaza.fetch` 加 `console.log`，切换 sort/filter 观察「序列号丢弃旧请求」的行为。
- 比较一下 `frontends/vue3-ts` 或 `frontends/angular` 的同名页面，理解相同 UI 在 Vue Composition API / Angular Signals 下怎么写——这是这个项目最大的价值。

之后可以再深入研究 React 的几个常见进阶主题：`useReducer` 与 Context API（不用第三方库的状态管理）、`Suspense` + 数据获取、React Server Components、性能优化的 `useMemo / useCallback / React.memo` 三件套、Testing Library 的组件测试。本项目刻意保持极简，把这些留给后续。
