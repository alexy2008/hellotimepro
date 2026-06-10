# HelloTime Pro Laravel 全栈技术手册与代码导读

本文说明 HelloTime Pro 的 Laravel 全栈实现如何在保持统一 API 契约的前提下，用 Laravel 的本地习惯完成服务端渲染应用。与 Next/Nuxt 手册相比，本手册补齐整体地图、运行验证、入口文件、框架思想、数据层、服务端架构、客户端交互、样式和常见改动路径。

## 1. 技术选型与设计特色

Laravel 版运行在 **7182** 端口，是 PHP 现代全栈代表：

- `routes/web.php` 定义服务端渲染页面和表单提交。
- `routes/api.php` 定义 `/api/v1/*` JSON REST 契约。
- Controller 只处理 HTTP 边界。
- 业务规则拆在 `app/Services/*`。
- 数据访问用 **Eloquent ORM**（`app/Models/*` 模型 + 关系 + Cast），展示 Laravel 的招牌特性。
- 跨库存储格式差异（id/时间戳/布尔）集中在 `app/Support/CrossDb.php` 与自定义 Cast。
- Blade 模板负责 SSR。
- Alpine.js + 少量原生 JS 负责浏览器状态和 fetch。
- API 与页面共享同一套 Service，避免 JSON 行为和页面行为分叉。

同一个进程提供两套接口：

| 入口 | 消费者 | 鉴权 | 输出 |
|---|---|---|---|
| `/api/v1/*` | 契约测试、浏览器 fetch | Bearer 或同源 cookie | JSON envelope |
| Web 页面 | 浏览器导航、表单提交 | httpOnly cookie | Blade HTML |

## 2. 先建立整体地图

```text
fullstacks/laravel/
  README.md
  TECHNICAL_GUIDE.md
  run / build / test
  composer.json / package.json
  routes/
    api.php
    web.php
  app/
    Http/Controllers/
      Api/V1/HelloTimeApiController.php
      Web/
        PageController.php
        AuthController.php
        CapsuleController.php
    Models/
      User.php
      Capsule.php
      Favorite.php
      RefreshToken.php
      Concerns/HasCrossDbKey.php   # 字符串主键 + 跨库 id 生成 trait
    Casts/
      CrossDbBoolean.php           # 跨库布尔自定义 Cast
    Services/
      AuthService.php
      CapsuleService.php
      PlazaService.php
      FavoriteService.php
      ProfileService.php
      SuggestionService.php
      HealthService.php
      AvatarCatalog.php
      LlmClient.php
    Support/
      CrossDb.php                  # 存储格式 ↔ 契约 换算（id/时间戳/布尔）
      JwtCodec.php
      Mapper.php                   # Eloquent 模型 -> DTO
      Validation.php
      Formatter.php
    Exceptions/
      ApiError.php
      LlmException.php
  resources/
    views/
      layouts/app.blade.php
      public/{home,open,about}.blade.php
      auth/{login,register}.blade.php
      capsules/{create,detail}.blade.php
      me/{created,favorites,profile}.blade.php
      components/*.blade.php
    css/app.css
  public/
    css/app.css
    js/app.js
    js/alpine.min.js
    static/{avatars,icons}/
  database/
    migrations/0001_01_01_000000_create_hellotime_schema.php
```

读代码时按这两条线走：

```text
JSON 契约
  -> routes/api.php
  -> HelloTimeApiController
  -> app/Services/*
  -> app/Models/*（Eloquent）-> 数据库
  -> app/Support/Mapper.php（模型 -> DTO）
  -> JSON envelope

SSR 页面
  -> routes/web.php
  -> Web/*Controller
  -> app/Services/* -> app/Models/*（Eloquent）
  -> resources/views/*.blade.php
  -> public/js/app.js 渐进增强
```

## 3. 如何运行和验证

数据库 schema/data 生命周期由仓库级脚本维护，Laravel `run` 只启动服务，不迁移、不 seed。

```bash
# PostgreSQL（默认）
./scripts/db reset --seed
./scripts/hello start laravel

# SQLite
DB_DRIVER=sqlite ./scripts/db reset --seed
DB_DRIVER=sqlite ./scripts/hello start laravel
```

直接在实现目录运行：

```bash
cd fullstacks/laravel
./build   # composer install + npm install + Alpine 静态文件准备
./run     # 启动 7182
./test    # Laravel/PHPUnit 入口
```

验收命令：

```bash
./verification/scripts/verify-contract.sh laravel
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh laravel
./verification/scripts/verify-ui-smoke.sh laravel
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh laravel
```

目标覆盖与 Next/Nuxt 一致：契约 104 例、UI 冒烟 25 例。

## 4. 入口文件导读

### 4.1 `routes/api.php`

`routes/api.php` 把 `/api/v1/*` 全部挂到 `HelloTimeApiController`：

- `GET /api/v1/health`
- `GET /api/v1/avatars`
- `POST /api/v1/auth/register|login|refresh|logout`
- `GET/PATCH /api/v1/me`
- `POST /api/v1/me/password`
- `GET/DELETE /api/v1/me/capsules`
- `GET/POST/DELETE /api/v1/me/favorites`
- `POST /api/v1/capsules`
- `GET /api/v1/capsules/{code}`
- `GET /api/v1/plaza/capsules`
- `GET /api/v1/plaza/capsules/{id}`
- `POST /api/v1/capsule-suggestion`
- `GET /api/v1/capsule-recommendations`

控制器里每个方法都调用 `api(fn () => ...)`，统一成功 envelope、业务错误和 500 兜底。

### 4.2 `routes/web.php`

`routes/web.php` 是 SSR 页面入口：

- `/`：广场。
- `/open`：开启页。
- `/about`：关于页。
- `/login` / `/register` / `/logout`：登录注册登出。
- `/create`：创建页和表单提交。
- `/c/{code}`、`/capsules/{code}`、`/plaza/{id}`：胶囊详情。
- `/me/created`、`/me/favorites`、`/me/profile`：个人中心。

### 4.3 `HelloTimeApiController.php`

这是 JSON 契约边界。它的职责很窄：

- 从 `Request` 读取 query、path、body。
- 调用 `AuthService`、`CapsuleService`、`PlazaService` 等服务。
- 把 `ApiError` 映射成 `{ success:false, data:null, message, errorCode }`。
- 把未知异常报告后映射成 `INTERNAL_ERROR`。

业务规则不要写进这里。

### 4.4 `Web/*Controller.php`

Web 控制器返回 Blade 或 Redirect：

- `PageController`：公开页和个人中心页面的数据准备。
- `AuthController`：表单登录/注册，写入 httpOnly cookie。
- `CapsuleController`：创建胶囊、删除自己的胶囊。

页面与 API 共用服务。例如创建胶囊：

```text
POST /api/v1/capsules
  -> HelloTimeApiController::createCapsule()
  -> CapsuleService::createCapsule()

POST /create
  -> Web\CapsuleController::store()
  -> CapsuleService::createCapsule()
```

## 5. Laravel 的核心思想

### 5.1 路由表显式集中

Next/Nuxt 用文件路径代表路由，Laravel 把路由集中在 `routes/*.php`。查入口时先看 route，再跳 Controller。

这对全栈实现有一个好处：JSON API 和 Web 页面可以在同一个地方看清边界，不会混在组件树里。

### 5.2 Blade 是服务端模板，不是客户端组件

Blade 模板在服务端拿到数组数据后直接输出 HTML。比如广场页由 `PageController::home()` 调 `PlazaService::plazaList()`，然后渲染 `resources/views/public/home.blade.php`。

模板职责是结构和展示；校验、权限、收藏计数、分页查询都在服务层。

### 5.3 Alpine.js 做轻量浏览器状态

Laravel 版没有引入 Vue/React，也没有把页面变成 SPA。`public/js/app.js` 注册 Alpine data/store：

- `theme`：主题状态。
- `countdown`：倒计时。
- `favButton`：收藏按钮。
- `codeInput`：8 位胶囊码。
- `createCapsule`：创建页快速预设、AI 推荐和生成。
- `shareActions`：复制和分享。
- `profileEditor`：资料保存和改密。
- `avatarPicker`：头像选择。

适合服务端渲染的内容留在 Blade；适合浏览器即时状态的交互交给 Alpine。

## 6. 数据层：Eloquent ORM + CrossDb

### 6.1 用 Eloquent 承载数据访问

数据访问全部走 **Eloquent ORM**——这是 Laravel 最具代表性的特性，本实现刻意用它来体现框架价值：

- **模型**：`app/Models/{User,Capsule,Favorite,RefreshToken}.php`。
- **关系**：`Capsule belongsTo owner(User)`、`hasMany favorites`；`User hasMany capsules/favorites/refreshTokens`。列表查询用 `with('owner')` 预加载避免 N+1。
- **查询构建器**：`Capsule::query()->where(...)->orderByDesc(...)->forPage(...)->get()`；搜索用 `whereHas('owner')`；收藏计数用 `increment/decrement`；并发用 `lockForUpdate()` + `DB::transaction()`。

**跨库的两个关键取舍**（spec/db schema 下 SQLite 存 32-hex + ISO TEXT、Postgres 存原生 uuid + timestamptz）：

1. **id 与时间戳不做 Eloquent Cast**，在模型里保持存储格式。因为关系 join 和 `where` 用的是原始存储值——若把 id Cast 成带横线 UUID，SQLite（存 32-hex）的关系关联会失配。转换只在**输出边界**（`Mapper`）做：id → 标准 UUID、时间戳 → `...Z`；客户端传入的 id 在**查询边界**用 `CrossDb::canonicalUuid/idToDb` 归一。
2. **布尔用自定义 Cast** `App\Casts\CrossDbBoolean`。不能用 Eloquent 原生 `boolean` Cast——PDO pgsql 把 boolean 读回成 `'t'/'f'` 字符串，而原生 Cast 等价 `(bool)'f'` 竟为 `true`，会把「未公开」误判成「公开」。自定义 Cast 读时显式归一、写时按驱动产出 `0/1` 或 `'true'/'false'`。

> ⚠️ 还有一处与裸 SQL INNER JOIN 等价的语义需保留：列表/详情查询都加了 `has('owner')`，把 owner 已被级联删除的「孤儿胶囊」排除在外（否则 `with('owner')` 会带 null owner 进 `Mapper` 触发 NPE）。

### 6.2 `CrossDb.php` 与字符串主键

数据访问交给 Eloquent 后，`app/Support/CrossDb.php` 收敛为纯粹的**存储格式 ↔ 对外契约换算器**，供模型 Cast、服务层（查询绑定/写入）与 `Mapper`（输出）复用，屏蔽三类跨库差异：

- id：SQLite 32 位无横线 hex，PostgreSQL 标准 UUID；对外统一带横线 UUID。
- 时间戳：SQLite ISO-8601 TEXT，PostgreSQL timestamptz；对外统一 `...Z`。
- 布尔：SQLite `0/1`，PostgreSQL `'true'/'false'`。

主键不是自增整数：模型用 `App\Models\Concerns\HasCrossDbKey` trait 设 `$incrementing=false`、字符串主键、关闭 Eloquent 自带时间戳，并在 `creating` 钩子按驱动生成存储格式 id（与演示数据 seed 对齐）。

### 6.3 Service 分层

主要服务：

- `AuthService`：注册、登录、refresh token rotate、登出、当前用户解析、改密。
- `CapsuleService`：创建、按码查询、我的胶囊、删除自己的胶囊。
- `PlazaService`：公开列表、详情、搜索、排序、过滤。
- `FavoriteService`：收藏、取消收藏、我的收藏、计数维护。
- `ProfileService`：昵称和头像更新。
- `SuggestionService`：AI 推荐和生成，失败时走本地模板兜底。
- `HealthService`：`/api/v1/health` 的 stack metadata。
- `LlmClient`：外部 LLM HTTP 调用及结构化日志。

### 6.4 migration 文件的定位

`database/migrations/0001_..._hellotime_schema.php` 是 Laravel 写法参考。项目验证和本地数据生命周期仍以 `spec/db` + `scripts/db` 为准；`run` 不执行 `php artisan migrate`。

## 7. 服务端架构：Route -> Controller -> Service -> Support

### 7.1 JSON envelope

`HelloTimeApiController::api()` 统一输出：

```json
{
  "success": true,
  "data": {},
  "message": null,
  "errorCode": null
}
```

`ApiError` 携带 HTTP status、`errorCode`、message 和可选 details。输入 JSON 非法时返回 400；字段校验不合法时返回 422。

### 7.2 鉴权与会话

API 契约要求 Bearer token。SSR 页面更适合 httpOnly cookie，所以 Laravel 版采用双入口解析：

- 契约测试带 `Authorization: Bearer <access>`。
- 浏览器登录/注册后写入 `ht_access` / `ht_refresh` cookie。
- 浏览器 fetch `/api/v1/me`、`/api/v1/me/favorites` 时没有 Authorization 头，但同源请求自动带 cookie，`AuthService::currentUser()` 会解析 `ht_access`。

access token 是 HS256 JWT，有效期 1 小时。refresh token 是随机不透明字符串，数据库只存 SHA-256 hash、family id、过期时间和撤销时间。refresh 时 rotate；复用已撤销 token 会吊销整个 family。

### 7.3 收藏和 `favorite_count`

`FavoriteService` 在 `DB::transaction()` 里用 Eloquent 维护收藏：

- `addFavorite()`：`Capsule::where(...)->lockForUpdate()->first()` 锁行、检查公开状态和不能收藏自己、`Favorite::create()`、`$cap->increment('favorite_count', 1, ['updated_at' => $now])`。
- `removeFavorite()`：幂等 `Favorite::where(...)->delete()`，删除成功才 `Capsule::where('favorite_count','>',0)->decrement(...)`（`> 0` 守卫把计数下限钳在 0）。
- PostgreSQL 走 `lockForUpdate()` 序列化并发；SQLite 依赖单写事务。

前端收藏按钮用 Alpine 异步 fetch 调 `/api/v1/me/favorites` 和 `/api/v1/me/favorites/{id}`，与 Spring/Rails 的同步 `/ui/*` 切换不同。

> 收藏测试「点完收藏立刻 `goto('/me/favorites')`」曾在 PostgreSQL 上偶发 `net::ERR_ABORTED`。根因不在收藏层，而在广场**搜索框**：`@input.debounce.300ms` 触发整页 `form.submit()`，这个迟到的导航与测试随后的 `goto` 相撞。修复是给提交加焦点守卫 `document.activeElement === $el && $el.form.submit()`——只在搜索框仍持有焦点时才提交；用户中途点了卡片/收藏（焦点已离开）就不再触发那次迟到跳转。这既消除竞态，也是更合理的实时搜索 UX。

## 8. 客户端：Blade + Alpine + 原生 fetch

### 8.1 `layouts/app.blade.php`

公共布局包含：

- HTML head、全局 CSS/JS 引入。
- Header、用户菜单、登录态入口。
- 主题切换。
- Footer 和技术栈展示。

页面模板只填自己的主体内容。

### 8.2 Blade components

`resources/views/components/*` 承担复用：

- `capsule-card.blade.php`：广场、我创建的、我收藏的共用卡片。
- `pagination.blade.php`：分页。
- `me-nav.blade.php`：个人中心导航。

这对应 Next/Nuxt 的 `components/*`，只是渲染发生在服务端。

### 8.3 `public/js/app.js`

`app.js` 是浏览器增强入口。它不保存 access token，因为 token 在 httpOnly cookie 中；fetch 同源 API 时浏览器自动携带 cookie。

AI 相关交互直接请求：

- `GET /api/v1/capsule-recommendations?count=4`
- `POST /api/v1/capsule-suggestion`

资料页直接请求：

- `PATCH /api/v1/me`
- `POST /api/v1/me/password`

这样 UI smoke 可以像 Next/Nuxt 一样 mock `/api/v1/*`。

## 9. 样式：Tailwind v4 + 设计令牌

Laravel 版样式源在 `resources/css/app.css`，构建产物在 `public/css/app.css`。

约束与 Next/Nuxt 相同：

- 使用 `spec/styles` 的 token。
- 复用 `cy-*` 组件类。
- 不在 Blade 中硬编码颜色和间距。
- 修改样式后通过 `./build` 生成最新静态 CSS。

Alpine.js 被复制到 `public/js/alpine.min.js`，避免运行时依赖 CDN。

## 10. 与 Next/Nuxt 的并排对比

| 关注点 | Next/Nuxt | Laravel |
|---|---|---|
| 页面路由 | 文件系统路由 | `routes/web.php` |
| API 路由 | `route.ts` / `server/api/*.ts` | `routes/api.php` |
| 页面渲染 | React/Vue 组件 | Blade 模板 |
| 浏览器状态 | Zustand/Pinia + Client Component | Alpine.js data/store |
| 数据层 | Drizzle | Eloquent ORM + CrossDb |
| 鉴权 | cookie/server helpers | Bearer 或 httpOnly cookie 双解析 |
| 样式 | Tailwind v4 + tokens | Tailwind v4 + tokens |
| schema 生命周期 | `scripts/db` | `scripts/db` |

关键差异：Laravel 的页面是“服务器一次性准备数据并渲染 HTML”，不是客户端 store 驱动的 SPA。交互只在需要即时反馈时进入 Alpine。

## 11. 与 Rails / Spring MVC 的对照

| 关注点 | Spring MVC | Rails | Laravel |
|---|---|---|---|
| 模板 | Thymeleaf | ERB | Blade |
| 局部刷新 | HTMX | Turbo Frame/Stream | 以整页 SSR + Alpine fetch 为主 |
| 前端小状态 | 原生 JS | Stimulus | Alpine.js |
| 鉴权桥 | `CookieTokenFilter` 注入 Bearer | Rack middleware 注入 Bearer | `AuthService` 同时读 Bearer/cookie |
| 数据跨库 | Hibernate JdbcType | ActiveRecord Type + `CrossDb` | Eloquent 自定义 Cast + `CrossDb` |

三者都保持同一原则：一个进程提供 JSON API 和 SSR UI，页面与 API 共用业务服务。

## 12. 常见改动指南

- 新增 API：在 `routes/api.php` 加路由，在 `HelloTimeApiController` 加方法，业务放进 `app/Services/*`。
- 新增页面：在 `routes/web.php` 加路由，在 `Web/*Controller` 准备数据，新建 Blade 模板。
- 新增浏览器交互：优先用 Alpine data；需要契约行为时 fetch `/api/v1/*`。
- 修改 schema：先改 `spec/db` 和仓库级 `scripts/db`，再同步 Laravel migration 参考文件、对应 Eloquent 模型（`$fillable`/Cast/关系）与 `CrossDb`。
- 新增带跨库存储差异的字段：优先写自定义 Cast（参考 `CrossDbBoolean`），而不是在服务层散拼格式。
- 修改收藏：必须保留 `DB::transaction` 和 `favorite_count` 维护（`increment/decrement`）。
- 修改鉴权：同时验证 Bearer 契约和 httpOnly cookie 页面会话。
- 修改样式：优先复用 `cy-*` 类和 `spec/styles` token。
- 修改 LLM：保持 `LLM request` / `LLM response` / `LLM error` 结构化日志字段。

## 13. 学到这里之后

Laravel 版的核心价值是展示“PHP 框架本地习惯下的 spec 对齐”：

- 路由集中、Controller 薄、Service 承载业务。
- Blade 负责内容型页面的 SSR。
- Alpine 只处理小型浏览器状态。
- Eloquent ORM（模型/关系/Cast）承载数据访问，自定义 Cast + CrossDb 精确压住双数据库差异。
- `/api/v1/*` 仍然是黑盒验证的唯一契约来源。
