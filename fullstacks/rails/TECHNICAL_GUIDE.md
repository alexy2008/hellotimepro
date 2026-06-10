# HelloTime Pro Rails 全栈技术手册与代码导读

本文说明 Rails 全栈版如何在保持 `/api/v1/*` 契约不变的前提下，用 Rails 8 + Hotwire 完成服务端渲染 UI。与 Next/Nuxt 手册相比，本手册补齐整体地图、运行验证、入口文件、框架思想、数据层、服务端架构、客户端交互、样式和常见改动路径。

## 1. 技术选型与设计特色

Rails 版运行在 **7181** 端口，同一个进程提供两套入口：

| 入口 | 消费者 | 鉴权 | 输出 |
|---|---|---|---|
| `/api/v1/*` | 契约测试、浏览器 fetch | Bearer 或 cookie->Bearer 桥 | JSON envelope |
| SSR 页面 + `/ui/*` | 浏览器导航、Turbo、Stimulus | httpOnly cookie | ERB HTML / Turbo Stream / 少量 JSON |

它展示 Rails 的本地全栈习惯：

- `config/routes.rb` 同时定义 API、页面和 `/ui/*` 浏览器动作。
- API 控制器继承 `ActionController::API`，只返回 JSON envelope。
- 页面控制器继承 `ApplicationController`，用 ERB 渲染 HTML。
- Hotwire 中的 Turbo Frame/Stream 负责局部刷新。
- Stimulus 控制器负责浏览器小交互。
- Active Record 负责 PostgreSQL / SQLite 双驱动。
- Rack middleware `CookieTokenBridge` 把同源 cookie 注入成 Bearer 头，浏览器 fetch 可复用 API 控制器。

## 2. 先建立整体地图

```text
fullstacks/rails/
  README.md
  TECHNICAL_GUIDE.md
  run / build / test
  Gemfile
  package.json
  config/
    routes.rb
    database.yml
    application.rb
    importmap.rb
    initializers/
      tolerant_json_params.rb
  lib/
    middleware/cookie_token_bridge.rb
  app/
    controllers/
      api/v1/
        base_controller.rb
        health_controller.rb
        auth_controller.rb
        me_controller.rb
        capsules_controller.rb
        plaza_controller.rb
        ai_controller.rb
        avatars_controller.rb
      concerns/
        auth_resolution.rb
        cookie_auth.rb
      public_controller.rb
      auth_view_controller.rb
      create_controller.rb
      me_controller.rb
      ui_controller.rb
      static_assets_controller.rb
    services/
      auth_service.rb
      capsule_service.rb
      plaza_service.rb
      favorite_service.rb
      user_service.rb
      capsule_suggestion_service.rb
      capsule_recommendation_service.rb
      health_metadata.rb
      llm_client.rb
      security_service.rb
      mapper_service.rb
      validation.rb
    models/
      user.rb
      capsule.rb
      favorite.rb
      refresh_token.rb
      application_record.rb
    lib/
      cross_db.rb
      api_error.rb
    views/
      layouts/application.html.erb
      public/*.html.erb
      auth_view/*.html.erb
      create/new.html.erb
      me/*.html.erb
      shared/_pagination.html.erb
    javascript/
      application.js
      controllers/*.js
  tailwind/
    app.css
    layout.css
  public/
    css/app.css
```

读代码时按这两条线走：

```text
JSON 契约
  -> config/routes.rb namespace api/v1
  -> app/controllers/api/v1/*_controller.rb
  -> app/services/*
  -> app/models/*
  -> BaseController JSON envelope

SSR 页面
  -> config/routes.rb 页面 route
  -> app/controllers/*_controller.rb
  -> app/services/*
  -> app/views/**/*.erb
  -> Stimulus / Turbo 渐进增强
```

## 3. 如何运行和验证

数据库 schema/data 生命周期由仓库级 `scripts/db` 维护。Rails 应用不建表、不迁移、不 seed。

```bash
# PostgreSQL（默认）
./scripts/db reset --seed
./scripts/hello start rails

# SQLite
DB_DRIVER=sqlite ./scripts/db reset --seed
DB_DRIVER=sqlite ./scripts/hello start rails
```

直接在实现目录运行：

```bash
cd fullstacks/rails
./build   # bundle install + Tailwind 构建
./run     # 启动 7181
./test    # 跨库格式不变式
```

验收命令：

```bash
./verification/scripts/verify-contract.sh rails
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh rails
./verification/scripts/verify-ui-smoke.sh rails
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh rails
```

目标覆盖与 Next/Nuxt 一致：契约 104 例、UI 冒烟 25 例。

## 4. 入口文件导读

### 4.1 `config/routes.rb`

Rails 版所有入口集中在这里：

- `namespace :api do namespace :v1`：完整 `/api/v1/*` 契约。
- `root "public#index"`：广场首页。
- `/open`、`/about`、`/c/:code`：公开页面。
- `/login`、`/register`、`/logout`：SSR 鉴权页面和表单。
- `/create`：创建页面和表单。
- `/me/created`、`/me/favorites`、`/me/profile`：个人中心。
- `/ui/plaza/grid`、`/ui/capsules/:id/favorite-toggle`、`/ui/capsules/:id`：Hotwire/浏览器动作。
- `/static/avatars/*`、`/static/icons/*`：映射共享头像和图标资源。

### 4.2 `Api::V1::BaseController`

API 控制器基类负责：

- `wrap_parameters format: []`，避免 Rails 把 JSON body 包根键。
- `render_ok()` 输出统一成功 envelope。
- `rescue_from ApiError` 输出契约错误 envelope。
- `rescue_from StandardError` 兜底 500。
- `AuthResolution` 解析 Bearer token。

注意 `rescue_from` 注册顺序：Rails 后注册的处理器优先匹配，所以 `StandardError` 先注册，`ApiError` 后注册。

### 4.3 页面控制器

页面控制器继承 `ApplicationController`，通过 `CookieAuth` 获取当前用户：

- `PublicController`：广场、开启、关于、按码查看胶囊；也提供 `plaza_grid` Turbo Frame 局部。
- `AuthViewController`：登录、注册、登出，写入/清除 httpOnly cookie。
- `CreateController`：创建页和表单提交。
- `MeController`：我创建的、我收藏的、个人资料。
- `UiController`：收藏切换和撤回胶囊。
- `StaticAssetsController`：把共享 `spec/` 静态资源暴露给 Rails 页面。

### 4.4 ERB 与 Stimulus 入口

- `app/views/layouts/application.html.erb`：公共布局、头部、页脚、资源引入。
- `app/views/public/_plaza_grid.html.erb`：广场网格，整页和 Turbo Frame 共用。
- `app/views/public/_capsule_card.html.erb`：胶囊卡片。
- `app/views/public/_favorite_button.html.erb`：收藏按钮。
- `app/javascript/application.js`：加载 Stimulus。
- `app/javascript/controllers/*.js`：每个浏览器行为一个 controller。

## 5. Rails + Hotwire 的核心思想

### 5.1 路由集中，Controller 命名约定

Next/Nuxt 用目录表达路由；Rails 用 `config/routes.rb` 显式声明，然后按 controller/action 分发。查一个 URL 时先看 routes，再看对应 controller。

### 5.2 ERB 是服务器输出 HTML

Rails 页面控制器准备实例变量，例如 `@items`、`@pagination`、`@capsule`，ERB 模板直接渲染 HTML。业务规则不放在视图里，视图只做展示和少量条件渲染。

### 5.3 Turbo Frame/Stream 是 HTML 局部协议

广场搜索使用 Turbo Frame：

```text
Stimulus 输入防抖
  -> form.requestSubmit()
  -> GET /ui/plaza/grid
  -> PublicController#plaza_grid
  -> render partial: "public/plaza_grid"
  -> 替换 #plaza-grid
```

撤回胶囊使用 Turbo Stream：删除成功后服务端返回移除对应卡片的 stream。

### 5.4 Stimulus 只管小交互

Stimulus controllers 包括：

- `theme_controller.js`：主题。
- `user_menu_controller.js`：用户菜单。
- `plaza_search_controller.js`：广场搜索防抖提交。
- `favorite_controller.js`：收藏切换。
- `create_controller.js`：创建页快速预设、AI 推荐和生成。
- `code_input_controller.js`：8 位码输入。
- `countdown_controller.js`：倒计时。
- `avatar_picker_controller.js`：头像选择。
- `profile_controller.js`：资料保存和改密。
- `clipboard_controller.js`：复制。

Rails 版不引入 SPA store。需要持久化的状态仍在服务端；需要即时响应的状态交给 Stimulus。

## 6. 数据层：Active Record + CrossDb

### 6.1 Active Record 模型

主要模型：

- `User`
- `Capsule`
- `Favorite`
- `RefreshToken`

`ApplicationRecord` 统一挂载跨库类型。业务查询集中在 `app/services/*`，模型不承载过多业务流程。

### 6.2 `CrossDb`

`app/lib/cross_db.rb` 处理 PostgreSQL 与 SQLite 的差异：

- SQLite 下 id 存 32 位无横线 hex TEXT；PostgreSQL 用原生 uuid。
- SQLite 下时间戳存 ISO-8601 TEXT；PostgreSQL 用 timestamptz。
- API 输出统一为带横线 UUID 和 `...Z` UTC instant。
- 非法 UUID 宽松解析为 nil，由调用方转 404，避免数据库类型错误变 500。

SQLite 自定义类型：

- `CrossDb::SqliteUuidType`
- `CrossDb::SqliteTimestampType`

这对应 Spring MVC 的 Hibernate JdbcType 和 Laravel 的 `CrossDb` helper。

### 6.3 `database.yml`

`config/database.yml` 用 ERB 解析 `DB_DRIVER` / `DB_URL`：

- `DB_DRIVER=postgres`：连接外部 PostgreSQL。
- `DB_DRIVER=sqlite`：连接 repo 配置的 SQLite 文件。

应用启动不负责创建 schema。

### 6.4 favorite_count 一致性

`FavoriteService` 在事务里维护收藏和计数：

- 添加收藏时锁胶囊行，禁止收藏自己和未公开胶囊。
- 插入 `favorites` 后递增 `favorite_count`。
- 取消收藏删除行后递减计数。
- PostgreSQL 使用 `SELECT ... FOR UPDATE`。
- SQLite 依赖单写事务。

不要绕过 `FavoriteService` 直接改 favorites 表。

## 7. 服务端架构：Controller -> Service -> Model

### 7.1 API 层

API 控制器只做边界工作：

- 读取 params/body/query。
- `require_user!` 或 `optional_user`。
- 调服务。
- `render_ok`。

错误统一通过 `ApiError` 表达，不让 ActiveRecord 异常直接泄露到契约响应。

### 7.2 Service 层

主要服务：

- `AuthService`：注册、登录、refresh token rotate、登出。
- `SecurityService`：JWT 签发和解析。
- `CapsuleService`：创建、按码查询、我的胶囊、删除。
- `PlazaService`：公开列表、详情、搜索、排序、过滤。
- `FavoriteService`：收藏、取消收藏、收藏列表。
- `UserService`：资料更新和改密。
- `CapsuleSuggestionService` / `CapsuleRecommendationService`：AI 生成与推荐。
- `LlmClient`：外部 LLM HTTP 调用及结构化日志。
- `HealthMetadata`：`/api/v1/health` 和关于页技术栈信息。

### 7.3 cookie -> Bearer 桥

API 契约要求 Bearer token，SSR 页面使用 httpOnly cookie。Rails 版用 Rack middleware 桥接：

```text
若 PATH_INFO 以 /api/v1/ 开头
且 HTTP_AUTHORIZATION 为空
且 Cookie 中有 ht_access
则设置 HTTP_AUTHORIZATION = Bearer <ht_access>
```

对应文件：`lib/middleware/cookie_token_bridge.rb`。

这样浏览器同源 fetch `/api/v1/me`、`/api/v1/capsule-suggestion` 时不需要 JS 读取 token，也能复用 API 控制器。契约测试带真实 Bearer 时 middleware 不介入。

### 7.4 SSR cookie 会话

`CookieAuth` concern 负责：

- 从 `ht_access` 解析当前用户。
- access 过期时用 `ht_refresh` refresh 一次。
- refresh 成功后重写 cookie。
- refresh 失败时清 cookie。
- `require_login!` 保护页面。

它不会每次导航都 refresh，避免 refresh token 重用检测误伤正常会话。

## 8. 客户端：Turbo + Stimulus

### 8.1 广场搜索

`plaza_search_controller.js` 监听 input，防抖后 `requestSubmit()`。注意不能只监听 keyup，因为 Playwright `fill()` 主要派发 input 事件。

### 8.2 收藏切换为什么用同步 XHR

UI 冒烟有路径会“点收藏后立刻导航到 `/me/favorites`”。异步 fetch 可能被导航中止，或还未提交就被下一页 SSR 查询抢先读到。

Rails 版的 `favorite_controller.js` 对已登录收藏按钮使用同步 `XMLHttpRequest` 调 `/ui/capsules/{id}/favorite-toggle`，等待事务提交后再返回。匿名点击在客户端 confirm 后跳登录，不发请求。

### 8.3 AI 与资料页

创建页和资料页通过 Stimulus fetch JSON API：

- `GET /api/v1/capsule-recommendations`
- `POST /api/v1/capsule-suggestion`
- `PATCH /api/v1/me`
- `POST /api/v1/me/password`

这些请求通过 cookie->Bearer middleware 进入同一套 API 控制器，便于契约和 UI 测试保持一致。

## 9. 样式：Tailwind v4 + 设计令牌

Rails 版样式入口：

- `tailwind/app.css`
- `tailwind/layout.css`

构建产物：

- `public/css/app.css`

原则与 Next/Nuxt 一致：

- 复用 `spec/styles` 的 token。
- 复用 `cy-*` 组件类。
- 不在 ERB 中写硬编码颜色和间距。
- `public/css/app.css` 已提交，作为无 npm 环境的兜底。

JS 使用 importmap + Stimulus，不需要前端打包器。

## 10. 与 Next/Nuxt 的并排对比

| 关注点 | Next/Nuxt | Rails |
|---|---|---|
| 页面路由 | 文件系统路由 | `config/routes.rb` |
| API 路由 | `route.ts` / `server/api/*.ts` | `Api::V1::*Controller` |
| 页面渲染 | React/Vue 组件 | ERB 模板 |
| 局部刷新 | Client Component / Vue 状态 | Turbo Frame/Stream |
| 小交互 | Zustand/Pinia + 组件状态 | Stimulus controller |
| 数据层 | Drizzle | Active Record + CrossDb |
| 鉴权 | cookie/server helpers | Rack cookie->Bearer bridge |
| 样式 | Tailwind v4 + tokens | Tailwind v4 CLI + tokens |
| schema 生命周期 | `scripts/db` | `scripts/db` |

关键差异：Rails 使用 Hotwire 把“HTML 片段”作为局部交互协议，不把列表和详情重写成客户端数据渲染。

## 11. 与 Spring MVC / Laravel 的对照

| 关注点 | Spring MVC | Rails | Laravel |
|---|---|---|---|
| 模板 | Thymeleaf | ERB | Blade |
| 局部刷新 | HTMX | Turbo Frame/Stream | 整页 SSR + Alpine fetch 为主 |
| 前端小状态 | 原生 JS | Stimulus | Alpine.js |
| 鉴权桥 | Servlet Filter | Rack middleware | Service 同时读 Bearer/cookie |
| 数据跨库 | Hibernate JdbcType | ActiveRecord Type + `CrossDb` | `CrossDb` helper |

三者的共同点是：同一个进程提供 JSON API 和 SSR UI，页面与 API 共用业务服务，数据库生命周期交给仓库级脚本。

## 12. 常见改动指南

- 新增 API：在 `config/routes.rb` 的 `api/v1` namespace 加 route，新建或扩展 API controller，业务放进 service。
- 新增页面：在 `config/routes.rb` 加页面 route，controller 准备实例变量，新建 ERB。
- 新增局部刷新：能返回 HTML 片段的优先用 Turbo Frame/Stream；天然 JSON 的交互用 Stimulus fetch `/api/v1/*`。
- 修改 schema：先改 `spec/db` 和 `scripts/db`，再同步模型、`CrossDb` 类型和服务层查询。
- 修改收藏：必须经过 `FavoriteService`，保持事务和 `favorite_count`。
- 修改鉴权：同时验证 Bearer API、SSR cookie、cookie->Bearer fetch。
- 修改样式：改 `tailwind/*.css` 或 ERB 类名，运行 `./build` 更新 `public/css/app.css`。
- 修改 LLM：保持 `LLM request` / `LLM response` / `LLM error` 结构化日志字段。

## 13. 学到这里之后

Rails 版的核心价值是展示 Hotwire 风格的全栈实现：

- API 契约仍是 `/api/v1/*` 黑盒接口。
- 页面是同一业务服务的 SSR 表现。
- Turbo 处理适合 HTML 片段的局部刷新。
- Stimulus 处理小型浏览器行为。
- Active Record 的便利性通过 `CrossDb` 被约束到 spec 允许的存储格式内。

理解这套边界后，再看 Spring MVC 和 Laravel，会发现它们都是同一个产品/契约在不同 SSR 框架中的等价表达。
