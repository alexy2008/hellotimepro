# HelloTime Pro · Angular 19 + TypeScript

5 个前端实现之一：Angular 19（**Signals + standalone components**）+ TypeScript + Vite/esbuild（`@angular/build`）+ Tailwind v4。
状态层用 **NgRx Signal Store**（`signalStore` + `withState / withComputed / withMethods / withHooks`），
组件层全部 standalone、模板内联、用 `@if / @for` 控制流与 `signal() / computed()` 渲染。

## 快速开始

```bash
# 一次性：起一个后端（默认 FastAPI）并把 :9080 反代指过去
cd ../../
./scripts/hello start fastapi
./scripts/hello switch fastapi

# 启动前端（端口 7175）
cd frontends/angular
./run
# → http://localhost:7175
```

也可以跳过 :9080 反代直连某个后端：

```bash
BACKEND_PROXY=http://localhost:29010 ./run
```

> `./run` 会按 `BACKEND_PROXY` 动态生成 `proxy.conf.local.json`（Angular CLI 需要静态 JSON 代理文件），
> 把 `/api` 与 `/static` 转发到目标后端。

## 脚本

| 脚本 | 作用 |
|---|---|
| `./run` | 起 dev server（`ng serve`，端口 7175） |
| `./build` | 生产构建到 `./dist`（`ng build`） |
| `./test` | 类型检查（`tsc --noEmit -p tsconfig.app.json`） |

## 目录结构

```
src/
├── app/
│   ├── api/api.service.ts      ← fetch 封装、统一响应解包、access token 自动 refresh
│   ├── stores/                 ← NgRx Signal Store：auth · capsule · plaza · theme
│   ├── guards/auth.guard.ts    ← 函数式路由守卫（CanActivateFn）
│   ├── types/index.ts          ← 与 spec/api/openapi.yaml 对齐的 TS 类型
│   ├── utils/                  ← 倒计时 / 时间格式 / 头像 URL（纯函数）
│   ├── components/             ← 14 个 standalone 组件
│   │                              app-header · app-footer · theme-toggle · alert
│   │                              · capsule-card · capsule-grid · capsule-detail
│   │                              · capsule-code-input · plaza-toolbar · favorite-button
│   │                              · avatar-picker · pagination · main-layout · me-layout
│   ├── pages/                  ← 11 个路由页面（standalone，loadComponent 懒加载）
│   │   ├── plaza                  /
│   │   ├── open                   /open
│   │   ├── about                  /about
│   │   ├── login                  /login
│   │   ├── register               /register
│   │   ├── create                 /create        （authGuard）
│   │   ├── capsule-by-code        /c/:code
│   │   ├── me-created             /me/created    （authGuard）
│   │   ├── me-favorites           /me/favorites  （authGuard）
│   │   ├── me-profile             /me/profile    （authGuard）
│   │   └── not-found              **
│   ├── app.routes.ts           ← 路由表（懒加载 + authGuard）
│   ├── app.config.ts           ← provideRouter / provideHttpClient 等应用级 providers
│   └── app.component.ts        ← 根组件：hydrate auth/theme + 自动 /me 校验
├── main.ts                     ← bootstrapApplication(AppComponent, appConfig)
├── index.html                  ← 提早注入 data-theme 的内联脚本，避免首屏闪白
└── styles/
    ├── index.css               ← Tailwind v4 + spec/styles/{palette,tokens,cyber}.css
    └── layout.css              ← 页面级布局类（与 react-ts / vue3-ts 同源；纯 CSS 无框架耦合）
```

## Angular 19 特色落点

| 维度 | 体现 |
|---|---|
| 状态 | **NgRx Signal Store**：`signalStore({ providedIn: 'root' }, withState(...), withComputed(...), withMethods(...), withHooks(...))` 得到基于 signal 的全局单例；用 `patchState(store, partial)` 更新，组件里直接读 `store.user()` 等 signal |
| 派生值 | `withComputed` 内的 `computed()`，组件内也用 `computed()`（如 `app-footer` 的 `backendItems` / `dotClass` 已 computed 化，避免模板每次变更检测重算） |
| 副作用 | `effect()` + `withHooks({ onInit })`；倒计时等以 `effect` 驱动并在 `DestroyRef` / `effect` 清理回调里释放 |
| 依赖注入 | **`inject()` 函数式注入**（`private api = inject(ApiService)`），不再用构造器注入；函数式守卫 `authGuard: CanActivateFn` 同样 `inject(Router)` |
| 组件 | **全部 standalone**（无 NgModule），`template` 内联书写，`imports: [...]` 直接声明依赖组件 |
| 模板 | Angular 17+ 控制流 **`@if / @for / @switch`**（取代 `*ngIf / *ngFor`）；`@for` 必须带 `track` |
| 路由 | `provideRouter(routes)` + **`loadComponent` 路由级懒加载**；嵌套 `children` 配合 `MainLayout / MeLayout` 的 `<router-outlet>`；`canActivate: [authGuard]` 守卫 `/create` 与 `/me/*` |
| 表单 | 模板驱动 `[(ngModel)]` 双向绑定（`FormsModule`），与 Vue `v-model` 对位 |

## 设计要点

- **设计令牌单一来源**：`src/styles/index.css` 直接 `@import` `spec/styles/{palette,tokens,cyber}.css`，
  组件层只允许用语义令牌（`var(--color-*)`）和 `cy-*` 共享类，禁止直接消费色阶。
- **存储策略**：access token 仅在内存（`AuthStore` 的 signal），refresh token 与 user 持久化到 `localStorage`
  （教学版方案；XSS 风险见 `docs/02-design.md §7.2`）。
- **自动刷新**：`api.service.ts` 拦截 `401 + UNAUTHORIZED`，调用 `/auth/refresh` 拿新 access token
  后重放原请求；refresh 并发请求会被去重。
- **匿名收藏**：`favorite-button` 检测到匿名用户会弹确认框，跳 `/login?from=<当前路径>`；
  `login` 页读 `from` 参数登录后自动回跳。
- **倒计时**：未开启卡片每秒局部更新（基于 `effect` 启动 interval 并在销毁时清理），已开启卡片不再 setInterval。
- **主题持久化**：`hellotime.theme = "dark" | "light"`，并在 `index.html` 内联脚本里提早注入，避免首屏闪白。
- **路由路径**：与 react-ts / vue3-ts / solid 一致使用 `/c/:code`。

## 与契约对齐

| 契约要点 | 落点 |
|---|---|
| 统一响应包装 `{ success, data, message, errorCode }` | `src/app/api/api.service.ts` 解包并将失败映射成 `ApiError` |
| 错误码枚举 | `src/app/types/index.ts` `ErrorCode` |
| 8 位胶囊码 `[A-Z0-9]{8}` | `capsule-code-input` 强制大写 + 字符过滤 |
| 广场 sort/filter/q + 分页 | `PlazaStore` + `plaza-toolbar`（搜索 300ms 防抖） |
| 头像列表 `/api/v1/avatars` | `register` / `me-profile` 取自 API |
| 健康检查 `/api/v1/health` | `app-footer` / `about` 渲染当前后端栈 |

## 验证

```bash
# 类型检查
./test

# 生产构建
./build

# UI 冒烟（25 个 Playwright 用例；会先 ./scripts/db init）
cd ../../ && ./verification/scripts/verify-ui-smoke.sh angular
```
