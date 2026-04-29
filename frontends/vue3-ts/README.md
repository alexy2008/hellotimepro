# HelloTime Pro · Vue 3 + TypeScript

5 个前端实现之一：Vue 3.5 + TypeScript + Vite 6 + Tailwind v4 + Pinia + vue-router 4。
全程 `<script setup lang="ts">` 单文件组件 + 组合式 API。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI）
cd ../../
docker compose up -d postgres
./scripts/hello start fastapi
./scripts/hello switch fastapi   # 把 :9080 指向 fastapi

# 启动前端（端口 7173）
cd frontends/vue3-ts
./run
# → http://localhost:7173
```

也可以跳过 :9080 反代直连后端：

```bash
BACKEND_PROXY=http://localhost:29010 ./run
```

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（端口 7173） |
| `./build` | 生产构建到 `./dist` |
| `./test` | 跑单元测试（vitest） |

## 目录结构

```
src/
├── api/client.ts            ← fetch 封装、统一响应解包、access token 自动 refresh
├── stores/                  ← Pinia：auth · theme · plaza（setup 风格）
├── composables/             ← useCountdown · useDebouncedRef · useClickOutside
├── types/                   ← 与 spec/api/openapi.yaml 对齐的 TS 类型
├── utils/                   ← 倒计时 / 时间格式 / 头像 URL
├── components/              ← 14 个 .vue
│                              AppHeader · AppFooter · ThemeToggle · AuthGate · Alert
│                              · CapsuleCard · CapsuleGrid · PlazaToolbar · CapsuleCodeInput
│                              · CapsuleDetail · FavoriteButton · AvatarPicker
│                              · MeLayout · MainLayout
├── pages/                   ← 11 个 .vue 路由页面
│   ├── PlazaPage              /
│   ├── OpenPage               /open
│   ├── AboutPage              /about
│   ├── LoginPage              /login
│   ├── RegisterPage           /register
│   ├── CreatePage             /create        （登录守卫）
│   ├── CapsuleByCodePage      /c/:code
│   ├── MeCreatedPage          /me/created    （登录守卫）
│   ├── MeFavoritesPage        /me/favorites  （登录守卫）
│   ├── MeProfilePage          /me/profile    （登录守卫）
│   └── NotFoundPage           *
├── router/index.ts          ← createWebHistory + meta.requiresAuth 守卫
├── App.vue                  ← hydrate auth/theme + 自动 /me 校验
├── main.ts                  ← createApp + Pinia + Router
└── styles/
    ├── index.css            ← Tailwind v4 + spec/styles/{palette,tokens,cyber}.css
    └── layout.css           ← 页面级布局类（与 react-ts 同源；纯 CSS 无框架耦合）
```

## Vue 特色落点

| 维度 | 体现 |
|---|---|
| 状态 | **Pinia setup 风格**：`useAuthStore` 用 `ref / computed`，比 options 风格更接近原生 ts 函数 |
| 副作用 | `onMounted / onUnmounted / watch / watchEffect` 替代 React 的 `useEffect` |
| 复用逻辑 | **composables**：`useCountdown` 封装 setInterval + 卸载清理；`useDebouncedRef` 封装防抖 |
| 表单 | 全程 **`v-model`** + `defineModel`（`CapsuleCodeInput`），登录 / 注册 / 改资料统一双向绑定 |
| 路由 | **`router.beforeEach`** 集中守卫 `meta.requiresAuth`，对照 React 的 `<AuthGate>` HOC |
| 动画 | **`<Transition>`** 用于用户菜单展开（轻量过渡） |
| 模板 | `<RouterView>` / `<RouterLink>` / `v-if` / `v-for` 直接命中 Vue 模板语法 |

## 设计要点

- **设计令牌单一来源**：`src/styles/index.css` 直接 `@import "../../../../spec/styles/{palette,tokens,cyber}.css"`，
  组件层只允许用语义令牌（`var(--color-*)`）和 `cy-*` 共享类，禁止直接消费色阶。
- **存储策略**：access token 仅在内存（Pinia state），refresh token 与 user 持久化到 `localStorage`
  （教学版方案；XSS 风险见 `docs/02-design.md §7.2`）。
- **自动刷新**：`api/client.ts` 拦截 `401 + UNAUTHORIZED`，调用 `/auth/refresh` 拿新 access token
  后重放原请求；refresh 并发请求会被去重。
- **匿名收藏**：`FavoriteButton` 检测到匿名用户会弹确认框引导登录，不静默失败
  （`docs/03-roadmap.md §9` 决策）。
- **倒计时**：未开启卡片每秒局部更新（`useCountdown`），已开启卡片不再 setInterval。
- **主题持久化**：`hellotime.theme = "dark" | "light"`，并在 `index.html` 的内联脚本里
  提早注入，避免首屏闪白。

## 与契约对齐

| 契约要点 | 落点 |
|---|---|
| 统一响应包装 `{ success, data, message, errorCode }` | `src/api/client.ts` 解包并将失败映射成 `ApiError` |
| 错误码枚举 | `src/types/index.ts` `ErrorCode` |
| 8 位胶囊码 `[A-Z0-9]{8}` | `CapsuleCodeInput` 强制大写 + 字符过滤 |
| 广场 sort/filter/q + 分页 | `usePlazaStore` + `PlazaToolbar`（搜索 300ms 防抖） |
| 头像列表 `/api/v1/avatars` | `RegisterPage` / `MeProfilePage` 取自 API |
| 健康检查 `/api/v1/health` | `AppFooter` / `AboutPage` 渲染当前后端栈 |
