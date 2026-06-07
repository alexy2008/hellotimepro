# Laravel Fullstack · 技术手册

本文说明 HelloTime Pro 的 Laravel 全栈实现如何在保持统一 API 契约的前提下，用 Laravel 的本地习惯完成服务端渲染应用。

## 1. 定位

Laravel 版是 M3 全栈矩阵中的 PHP 代表。它不是「PHP 内置服务器 + 手写 router」，而是标准 Laravel 应用：

- `routes/web.php` 定义页面路由与表单提交。
- `routes/api.php` 定义 `/api/v1/*` JSON REST 路由。
- Controller 只处理 HTTP 边界，返回 Blade 或 JSON envelope。
- `HelloTimeService` 承载应用服务：认证、胶囊、广场、收藏、资料、health metadata。
- Blade 模板负责 SSR，Alpine.js 负责轻量浏览器状态。

## 2. 一个进程，两套接口

| 接口 | 消费者 | 鉴权 | 输出 |
|---|---|---|---|
| `/api/v1/*` | 契约测试、浏览器 fetch | Bearer 或同源 cookie | JSON envelope |
| Web 页面 | 浏览器导航、表单提交 | httpOnly cookie | Blade HTML |

API 和 UI 共用 `HelloTimeService`。例如创建胶囊：

```text
POST /api/v1/capsules  -> Api\V1\HelloTimeApiController@createCapsule
POST /create           -> Web\CapsuleController@store
                         -> HelloTimeService::createCapsule()
```

这样 JSON 契约和页面行为不会分叉。

## 3. 鉴权与会话

API 契约要求 Bearer token。SSR 页面更适合 httpOnly cookie，所以 Laravel 版采用双入口解析：

- 契约测试带 `Authorization: Bearer <access>`，服务层优先解析 Bearer。
- 浏览器登录/注册后写入 `ht_access` / `ht_refresh` cookie。
- 浏览器 fetch `/api/v1/me`、`/api/v1/me/favorites` 时没有 Authorization 头，但同源请求自动带 cookie，服务层解析 `ht_access` 后得到同一个用户。

access token 是 HS256 JWT，有效期 1 小时。refresh token 是随机不透明字符串，数据库只存 SHA-256 hash、family id、过期时间和撤销时间。refresh 时会 rotate；复用已撤销 token 会吊销整个 family。

## 4. 数据库策略

项目级约束是：schema/data 生命周期由 `scripts/db` 维护，后端和全栈 `run` 脚本只启动服务。因此：

- `run` 不执行 `php artisan migrate`，也不 seed。
- `database/migrations/0001_..._hellotime_schema.php` 作为 Laravel migration 参考，展示 Laravel 下如何表达同一套 schema。
- 运行时通过 `DB_DRIVER=postgres|sqlite` 和 `DB_URL` 切换。

跨库差异集中在 `HelloTimeService`：

- PostgreSQL 使用 `timestamptz`，写入时间带 `+00:00`。
- SQLite 使用 TEXT 时间戳，写入可按字符串排序的 UTC 格式。
- PostgreSQL boolean 参数用 `"true"` / `"false"` 字符串绑定，避免 PDO 把 `false` 绑定为空字符串。

## 5. Blade + Alpine.js

Blade 负责所有用户可见页面：

- `layouts/app.blade.php`：公共 header/footer、技术栈展示、主题切换。
- `components/capsule-card.blade.php`：广场、我创建的、我收藏的共用卡片。
- `public/*.blade.php`：首页、开启页、关于页。
- `auth/*.blade.php`：登录、注册。
- `capsules/*.blade.php`：创建和详情。
- `me/*.blade.php`：个人中心。

Alpine.js 用在布局级主题状态：

```html
<body x-data="{ theme: localStorage.getItem('theme') || 'dark' }" ...>
```

更多与接口强相关的交互保留在 `public/js/app.js`：AI 推荐、AI 生成、8 位码输入、倒计时、收藏、资料页 fetch。这样 Playwright 的路由 mock 可以直接拦截 `/api/v1/capsule-recommendations` 和 `/api/v1/capsule-suggestion`。

## 6. 收藏为什么是同步 XHR

UI 冒烟有一条路径：点击广场收藏按钮后立刻 `goto('/me/favorites')`。SSR 页面是服务器一次性查询渲染，如果收藏请求还没提交，目标页不会出现刚收藏的卡片。

Laravel 版保留事务更新 `favorite_count` 的正确性，因此收藏请求可能比普通异步 fetch 慢一点。为避免竞态，已登录收藏按钮使用同步 `XMLHttpRequest`，等数据库事务提交后再允许后续导航。

## 7. Health Metadata

`GET /api/v1/health` 返回的 `stack.summary/items` 是关于页和页脚的单一来源。Laravel 版会显示：

- PHP
- Laravel
- Blade
- Alpine.js
- PostgreSQL 或 SQLite

关于页的后端技术栈段落直接展示 `health.stack.summary`，避免页面文字和接口返回不一致。

## 8. 常见改动路径

- 新增 API：在 `routes/api.php` 加路由，在 `HelloTimeApiController` 加方法，业务放进 `HelloTimeService`。
- 新增页面：在 `routes/web.php` 加路由，在 `PageController` 准备数据，新建 Blade 模板。
- 修改 schema：先改 `spec/db` 和仓库级 `scripts/db`，再同步 Laravel migration 参考文件。
- 修改样式：优先复用 `cy-*` 类和 `spec/styles` token，不在 Blade 中写硬编码色值。

## 9. 与 Rails / Spring MVC 的对照

- Rails 用 Hotwire（Turbo + Stimulus）承载局部刷新；Laravel 版用 Blade + Alpine + 原生 fetch。
- Spring MVC 用 Thymeleaf + HTMX；Laravel 版没有引入 HTMX，避免 JSON API 与 HTML fragment 双轨扩散。
- 三者都保持「同一进程提供 JSON API 和 SSR UI」，都用 cookie 会话打通浏览器 fetch 与 Bearer 契约。
