# HelloTime Pro · SolidJS + TypeScript

SolidJS 1.9 + TypeScript + Vite 6 + Tailwind v4 + `@solidjs/router` 0.16 实现的时光胶囊前端。
与参考实现 `frontends/react-ts` 行为对齐，共享同一份 API 契约与设计令牌；逻辑层（`api` / `types` /
`utils`）逐字复用，UI 层用 SolidJS 的**细粒度响应式**（Signals / Store）重写。

## 快速开始

```bash
# 一次性：起一个后端并把 :9080 反代指向它
cd ../../
./scripts/hello start fastapi
./scripts/hello switch fastapi   # 把 :9080 指向 fastapi

# 启动前端（端口 7180）
cd frontends/solid
./run
# → http://localhost:7180
```

也可以跳过 :9080 反代直连某个后端：

```bash
BACKEND_PROXY=http://localhost:29010 ./run
```

或用 dev manager：`./scripts/hello start solid`。

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（端口 7180） |
| `./build` | 类型检查 + 生产构建到 `./dist` |
| `./test` | 跑单元测试（vitest） |
| `npm run lint` | `tsc --noEmit`（仅类型检查） |

## 目录结构

```
src/
├── api/client.ts        ← fetch 封装、统一响应解包、access token 自动 refresh（与 react-ts 一致）
├── types/index.ts       ← 与 spec/api/openapi.yaml 对齐的 TS 类型（与 react-ts 一致）
├── utils/               ← 倒计时 / 时间格式 / 头像 URL（与 react-ts 一致）
├── stores/              ← SolidJS 全局状态（模块级 Signal / Store）
│   ├── theme.ts            createSignal 主题
│   ├── auth.ts             createStore 鉴权 + configureApi 注入
│   ├── plaza.ts            createStore 广场（sort/filter/q/分页）
│   └── capsule.ts          createStore 我创建的 / 我收藏的
├── components/          ← AppHeader · AppFooter · ThemeToggle · AuthGate
│                          · CapsuleCard · CapsuleGrid · PlazaToolbar · RecommendationStrip
│                          · CapsuleCodeInput · CapsuleDetail · FavoriteButton · AvatarPicker
│                          · MainLayout · MeLayout · Alert · Pagination
├── pages/              ← 路由对应页面
│   ├── PlazaPage           /
│   ├── OpenPage            /open
│   ├── AboutPage           /about
│   ├── LoginPage           /login
│   ├── RegisterPage        /register
│   ├── CreatePage          /create        （登录守卫）
│   ├── CapsuleByCodePage   /c/:code
│   ├── MeCreatedPage       /me/created    （登录守卫）
│   ├── MeFavoritesPage     /me/favorites  （登录守卫）
│   ├── MeProfilePage       /me/profile    （登录守卫）
│   └── NotFoundPage        *
├── App.tsx             ← <Router> 路由表 + hydrate auth/theme + 自动 /me 校验
├── main.tsx            ← render(() => <App/>, #root)
└── styles/
    ├── index.css       ← Tailwind v4 + spec/styles/{palette,tokens,cyber}.css
    └── layout.css      ← 页面级布局类（与 react-ts 一致）
```

## SolidJS 设计要点

- **细粒度响应式**：组件函数只运行一次，JSX 编译为直接的 DOM 操作。状态用 `createSignal` 读作
  `count()`、`createStore` 读作 `store.field`；读取建立订阅，更新只精准刷新用到它的那一处，无虚拟 DOM diff。
- **全局状态脱离组件树**：`stores/*` 在模块顶层创建 Signal / Store 并导出 getter + 动作函数，
  任意组件 `import { auth } from "@/stores/auth"` 即可读写——这是 SolidJS 相对 React Hooks 的一大特点。
- **控制流组件**：模板用 `<Show>` / `<For>` / `<Index>` 而非 `&&` 与 `.map()`，对响应式更友好。
- **props 不解构**：始终通过 `props.x` 访问以保持响应性（解构会丢失 getter）。
- **与契约解耦**：`api/client.ts` 通过 `configureApi()` 回调读 token，不直接 import store，避免循环依赖。
- **自动刷新**：拦截 `401 + UNAUTHORIZED`，调 `/auth/refresh` 拿新 access token 后重放原请求；并发 refresh 去重。
- **匿名收藏**：`FavoriteButton` 检测匿名用户弹确认框引导登录，不静默失败。
- **主题持久化**：`hellotime.theme`，并在 `index.html` 内联脚本提早注入避免首屏闪白。

## 与契约对齐

| 契约要点 | 落点 |
|---|---|
| 统一响应包装 `{ success, data, message, errorCode }` | `src/api/client.ts` 解包并将失败映射成 `ApiError` |
| 错误码枚举 | `src/types/index.ts` `ErrorCode` |
| 8 位胶囊码 `[A-Z0-9]{8}` | `CapsuleCodeInput` 强制大写 + 字符过滤 |
| 广场 sort/filter/q + 分页 | `stores/plaza.ts` + `PlazaToolbar`（搜索 300ms 防抖） |
| AI 创作辅助（建议 / 推荐） | `CreatePage` + `RecommendationStrip`，对应 `/capsule-suggestion`、`/capsule-recommendations` |
| 头像列表 `/api/v1/avatars` | `RegisterPage` / `MeProfilePage` 取自 API |
| 健康检查 `/api/v1/health` | `AppFooter` / `AboutPage` 渲染当前后端栈 |

## 验证

```bash
./verification/scripts/verify-ui-smoke.sh solid     # 等价：solid-ts
```

通过条件：25 个 Playwright 冒烟用例全绿（auth / capsules / me / plaza / smoke）。
更深入的实现导读见 [TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md)。
