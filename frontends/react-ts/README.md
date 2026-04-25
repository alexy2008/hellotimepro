# HelloTime Pro · React + TypeScript（参考前端）

M1 参考前端实现：React 19 + TypeScript + Vite 6 + Tailwind v4 + Zustand + react-router 7。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI）
cd ../../
docker compose up -d postgres
./scripts/hello start fastapi
./scripts/hello switch fastapi   # 把 :9080 指向 fastapi

# 启动前端（端口 7174）
cd frontends/react-ts
./run
# → http://localhost:7174
```

也可以跳过 :9080 反代直连后端：

```bash
BACKEND_PROXY=http://localhost:29010 ./run
```

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（端口 7174） |
| `./build` | 生产构建到 `./dist` |
| `./test` | 跑单元测试（vitest） |

## 目录结构

```
src/
├── api/client.ts        ← fetch 封装、统一响应解包、access token 自动 refresh
├── stores/              ← Zustand：auth · theme · plaza
├── types/               ← 与 spec/api/openapi.yaml 对齐的 TS 类型
├── utils/               ← 倒计时 / 时间格式 / 头像 URL
├── components/          ← AppHeader · AppFooter · ThemeToggle · AuthGate
│                          · CapsuleCard · CapsuleGrid · PlazaToolbar
│                          · CapsuleForm（CreatePage 内联）· CapsuleCodeInput
│                          · CapsuleDetail · FavoriteButton · AvatarPicker
│                          · MeLayout · MainLayout · Alert
├── pages/               ← 12 个路由对应页面
│   ├── PlazaPage           /
│   ├── OpenPage            /open
│   ├── AboutPage           /about
│   ├── LoginPage           /login
│   ├── RegisterPage        /register
│   ├── CreatePage          /create        （登录守卫）
│   ├── CapsuleByCodePage   /c/:code
│   ├── CapsuleByIdPage     /p/:id
│   ├── MeCreatedPage       /me/created    （登录守卫）
│   ├── MeFavoritesPage     /me/favorites  （登录守卫）
│   ├── MeProfilePage       /me/profile    （登录守卫）
│   └── NotFoundPage        *
├── router.tsx           ← 路由表 + AuthGate 注入
├── App.tsx              ← hydrate auth/theme + 自动 /me 校验
├── main.tsx             ← createRoot + StrictMode
└── styles/
    ├── index.css        ← Tailwind v4 + spec/styles/{palette,tokens,cyber}.css
    └── layout.css       ← 页面级布局类（容器 / Hero / Toolbar / Grid / Me / 详情）
```

## 设计要点

- **设计令牌单一来源**：`src/styles/index.css` 直接 `@import "../../../../spec/styles/tokens.css"`，
  组件层只允许用语义令牌（`var(--color-*)`）和 `cy-*` 共享类，禁止直接消费色阶。
- **Zustand 选择**：小而直接，符合 React 生态风气（见 `docs/02-design.md §9.2`）。
- **存储策略**：access token 仅在内存，refresh token 与 user 持久化到 `localStorage`
  （教学版的更简单方案；XSS 风险见 `docs/02-design.md §7.2`）。
- **自动刷新**：`api/client.ts` 拦截 `401 + access_token_expired`，调用 `/auth/refresh`
  拿新 access token 后重放原请求；refresh 并发请求会被去重。
- **匿名收藏**：`FavoriteButton` 检测到匿名用户会弹确认框引导登录，不静默失败
  （`docs/03-roadmap.md §9` 决策）。
- **倒计时**：未开启卡片每秒局部更新，已开启卡片不再 setInterval。
- **主题持久化**：`hellotime.theme = "dark" | "light"`，并在 `index.html` 的内联脚本里
  提早注入，避免首屏闪白。

## 与契约对齐

| 契约要点 | 落点 |
|---|---|
| 统一响应包装 `{ success, data, message, errorCode }` | `src/api/client.ts` 解包并将失败映射成 `ApiError` |
| 错误码枚举 | `src/types/index.ts` `ErrorCode` |
| 8 位胶囊码 `[A-Z0-9]{8}` | `CapsuleCodeInput` 强制大写 + 字符过滤 |
| 广场 sort/filter/q + 分页 | `usePlaza` + `PlazaToolbar`（搜索 300ms 防抖） |
| 头像列表 `/api/v1/avatars` | `RegisterPage` / `MeProfilePage` 取自 API |
| 健康检查 `/api/v1/health` | `AppFooter` / `AboutPage` 渲染当前后端栈 |

## 后续

- M1 通过条件：`verification/scripts/verify-ui-smoke.sh react-ts` 绿。
  入口流程：注册 → 创建公开胶囊 → 登出 → 匿名浏览 → 登录另一用户收藏 → 进"我收藏的"。
