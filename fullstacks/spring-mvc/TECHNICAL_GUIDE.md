# HelloTime Pro Spring MVC 全栈技术手册与代码导读

> 面向：读完 `docs/01-requirements.md`、`docs/02-design.md`、`docs/03-roadmap.md` 后，想理解 Spring MVC 全栈版如何在保持 `/api/v1/*` 契约不变的前提下，用 Thymeleaf + HTMX 做服务端渲染 UI 的读者。

与 Next/Nuxt 手册相比，本手册补齐同样的阅读路径：先看全局地图，再看运行验证、入口文件、框架思想、数据层、服务端架构、浏览器交互、样式和常见改动路径。

## 1. 技术选型与设计特色

Spring MVC 版运行在 **7179** 端口，同一个 Spring Boot 进程同时提供两套入口：

| 入口 | 消费者 | 鉴权 | 输出 |
|---|---|---|---|
| `/api/v1/*` | 契约测试、浏览器 fetch | `Authorization: Bearer` | JSON envelope |
| 页面 + `/ui/*` | 浏览器导航、HTMX、表单 | httpOnly cookie | HTML 整页 / HTML 片段 / 少量 JSON |

实现刻意展示传统 Java SSR 全栈的形态：

- Spring MVC `@RestController` 承载完整 JSON 契约。
- Spring MVC `@Controller` + Thymeleaf 承载服务端渲染页面。
- HTMX 负责广场搜索、撤回等局部 HTML 替换。
- 原生 JS 负责主题、头像选择、8 位码输入、AI 生成、资料页 fetch 等浏览器行为。
- Spring Data JPA + Hibernate 负责 PostgreSQL / SQLite 双驱动持久化。
- `CookieTokenFilter` 把同源 cookie 自动转换成 Bearer 头，让浏览器 fetch 复用同一套 API 控制器。

## 2. 先建立整体地图

```text
fullstacks/spring-mvc/
  README.md
  TECHNICAL_GUIDE.md
  run / build / test
  package.json                         # 仅 Tailwind CLI，运行期不依赖 Node
  tailwind/
    app.css
    layout.css
  src/main/java/com/hellotimepro/springmvc/
    HelloTimeProApplication.java
    config/
      AppProperties.java                # JWT/LLM/DB 等配置映射
      WebConfig.java                    # 过滤器、静态资源等 MVC 配置
    db/
      CrossDbUuidJdbcType.java          # SQLite/PG UUID 存储差异
      CrossDbOffsetDateTimeJdbcType.java
    domain/
      UserEntity.java
      CapsuleEntity.java
      FavoriteEntity.java
      RefreshTokenEntity.java
    repository/
      UserRepository.java
      CapsuleRepository.java
      FavoriteRepository.java
      RefreshTokenRepository.java
    service/
      AuthService.java
      CapsuleService.java
      PlazaService.java
      FavoriteService.java
      UserService.java
      CapsuleSuggestionService.java
      CapsuleRecommendationService.java
      HealthStackService.java
      LlmClientService.java
    web/
      *Controller.java                  # /api/v1 JSON 控制器
      CookieTokenFilter.java            # cookie -> Bearer 鉴权桥
      GlobalExceptionHandler.java
      web/view/
        PublicViewController.java       # / /open /about /c/:code
        AuthViewController.java         # /login /register /logout
        CreateViewController.java       # /create
        MeViewController.java           # /me/*
        FragmentController.java         # /ui/* HTMX/浏览器动作
        CookieAuthService.java
        GlobalModelAttributes.java
  src/main/resources/
    application.yml
    templates/
      plaza.html
      open.html
      about.html
      create.html
      capsule-detail.html
      login.html
      register.html
      me-created.html
      me-favorites.html
      me-profile.html
      fragments/
        layout.html
        capsule.html
        favorite.html
        plaza-grid.html
    static/
      js/app.js
      js/htmx.min.js
      css/app.css
      logo.svg
```

读代码时按这条线走最省力：

```text
浏览器页面请求
  -> web/view/*ViewController
  -> service/*
  -> repository/*
  -> domain/*
  -> Thymeleaf templates/*

JSON 契约请求
  -> web/*Controller
  -> service/*
  -> repository/*
  -> GlobalExceptionHandler JSON envelope

同源浏览器 fetch /api/v1/*
  -> CookieTokenFilter 注入 Authorization
  -> web/*Controller
```

## 3. 如何运行和验证

数据库 schema/data 生命周期由仓库级 `scripts/db` 维护。Spring MVC 的 `run` 只启动服务，不建表、不迁移、不 seed。

```bash
# PostgreSQL（默认，连接信息由 hello 从 data/.hello-state.json 注入）
./scripts/db reset --seed
./scripts/hello start spring-mvc

# SQLite
DB_DRIVER=sqlite ./scripts/db reset --seed
DB_DRIVER=sqlite ./scripts/hello start spring-mvc
```

直接在实现目录运行：

```bash
cd fullstacks/spring-mvc
./build   # Tailwind 生成 CSS + mvn package
./run     # 启动 7179
./test    # SQLite 上跑 SmokeTest
```

验收命令：

```bash
./verification/scripts/verify-contract.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh spring-mvc
./verification/scripts/verify-ui-smoke.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh spring-mvc
```

目标覆盖与 Next/Nuxt 一致：契约 104 例、UI 冒烟 25 例。

## 4. 入口文件导读

### 4.1 `HelloTimeProApplication.java`

这是标准 Spring Boot 启动类，负责启动内嵌 Web 容器并扫描 `com.hellotimepro.springmvc` 包下的组件。全栈版没有单独前端 dev server；页面、API、静态资源都由这个进程服务。

### 4.2 `application.yml`

默认端口是 `7179`。`hello start spring-mvc` 依赖注册端口和实际监听端口一致，所以不能把默认端口留成 Spring Boot 常见的 `8080`。

关键环境变量：

- `DB_DRIVER=postgres|sqlite`：选择数据库驱动。
- `DB_URL`：由 dev manager 注入；直接运行时可手动给。
- `JWT_SECRET`：access/refresh 相关签名密钥。
- `LLM_*`：AI 生成和推荐的外部模型配置。

### 4.3 `web/*Controller.java`

`web/` 下不带 `view` 的控制器是 JSON 契约入口，例如：

- `HealthController` -> `GET /api/v1/health`
- `AuthController` -> `/api/v1/auth/*`
- `CapsuleController` -> `/api/v1/capsules`
- `PlazaController` -> `/api/v1/plaza/capsules`
- `MeController` -> `/api/v1/me*`
- `FavoriteController` -> `/api/v1/me/favorites*`
- `CapsuleSuggestionController` / `CapsuleRecommendationController` -> AI 辅助接口

这些控制器是薄 HTTP 边界：解析参数、调用服务、交给 `GlobalExceptionHandler` 统一包 JSON envelope。

### 4.4 `web/view/*ViewController.java`

`web/view/` 是 SSR 页面入口：

- `PublicViewController`：广场首页、开启页、关于页、胶囊详情。
- `AuthViewController`：登录、注册、登出，成功后写 `ht_access` / `ht_refresh` cookie。
- `CreateViewController`：创建页和表单提交。
- `MeViewController`：我创建的、我收藏的、个人资料。
- `FragmentController`：`/ui/*` 局部片段和浏览器动作。

页面控制器同样调用 `service/*`，不在模板里塞业务规则。

### 4.5 `templates/fragments/*`

Thymeleaf fragment 承担复用：

- `layout.html`：公共 head/header/footer、技术栈展示、主题切换按钮。
- `capsule.html`：胶囊卡片。
- `favorite.html`：收藏按钮。
- `plaza-grid.html`：广场网格，供首页和 HTMX 局部刷新共用。

## 5. Spring MVC + Thymeleaf + HTMX 的核心思想

### 5.1 注解路由：URL 写在 Controller 上

Next/Nuxt 用文件系统路由，Spring MVC 用注解路由。对照关系大致是：

| Next/Nuxt | Spring MVC |
|---|---|
| `app/page.tsx` / `pages/index.vue` | `@GetMapping("/")` |
| `app/api/v1/health/route.ts` | `@GetMapping("/api/v1/health")` |
| `pages/c/[code].vue` | `@GetMapping("/c/{code}")` |
| `server/api/v1/me/favorites/[id].delete.ts` | `@DeleteMapping("/api/v1/me/favorites/{capsuleId}")` |

这让入口查找从“看目录”变成“搜注解”。维护时优先 `rg '@GetMapping|@PostMapping|@DeleteMapping|@PatchMapping' fullstacks/spring-mvc/src/main/java`。

### 5.2 SSR 页面是普通 Controller 返回 view name

`PublicViewController.plaza()` 返回 `"plaza"`，Spring 会渲染 `templates/plaza.html`。Controller 通过 `Model` 放入 `capsules`、`pagination`、`sort`、`filter`、`q`，模板只负责展示。

### 5.3 HTMX 让 HTML 片段成为交互协议

广场搜索不是返回 JSON 再由客户端拼 DOM，而是：

```text
input/change
  -> GET /ui/plaza/grid
  -> FragmentController.plazaGrid()
  -> templates/fragments/plaza-grid.html :: grid
  -> HTMX 替换 #plaza-grid
```

这条路径适合“服务端已经知道怎么渲染”的列表和片段。

### 5.4 原生 JS 处理纯浏览器行为

`static/js/app.js` 处理这些不适合 HTMX 的行为：

- 主题切换和用户菜单。
- 头像选择器。
- 8 位胶囊码输入、粘贴和自动跳转。
- 倒计时。
- 创建页快速预设、本地时间转 ISO。
- AI 推荐/生成，直接 fetch JSON API。
- 资料页保存、改密，直接 fetch JSON API。
- 收藏切换：**同步 XHR** 调 `/ui/capsules/{id}/favorite-toggle`，返回 JSON 新状态后更新按钮。

AI 和资料页请求命中 `/api/v1/*`，因为测试会拦截这些 API 路径，且 JSON 是它们的自然协议。

> **收藏为什么不用 HTMX？** 广场搜索、撤回胶囊都走 HTMX 局部替换，唯独收藏刻意用同步 XHR。
> 因为收藏的典型操作是「点收藏 → 立刻导航到 /me/favorites」；若用异步的 HTMX/`fetch`，
> 这次导航会 abort 掉尚未完成的收藏请求，事务来不及提交。同步 XHR 阻塞到事务提交后才返回，
> 保证后续导航能看到刚写入的收藏。这是「不是所有交互都适合声明式局部刷新」的一个典型取舍。

## 6. 数据层：Spring Data JPA + 双数据库

### 6.1 Entity 与 Repository

`domain/*Entity.java` 映射 `spec/db` 的表结构：

- `UserEntity` -> `users`
- `CapsuleEntity` -> `capsules`
- `FavoriteEntity` + `FavoriteId` -> `favorites`
- `RefreshTokenEntity` -> `refresh_tokens`

`repository/*Repository.java` 提供查询入口。复杂场景用显式查询方法，例如收藏计数需要行锁时，PostgreSQL 路径会通过 `findByIdForUpdate()` 拿 `PESSIMISTIC_WRITE`。

### 6.2 跨库 UUID 与时间戳

项目要求 PostgreSQL 和 SQLite 对外行为一致，但两者存储不同：

- PostgreSQL 用原生 `uuid` / `timestamptz`。
- SQLite 用 TEXT：UUID 为 32 位无横线 hex，时间戳为可排序 ISO-8601 文本。

差异集中在：

- `CrossDbUuidJdbcType.java`
- `CrossDbOffsetDateTimeJdbcType.java`

这两个 Hibernate JdbcType 是 Spring MVC 版对应 Ktor `CrossDbColumns`、Rails `CrossDb`、Laravel `CrossDb` 的实现。

### 6.3 favorite_count 一致性

`FavoriteService` 在事务内维护 `favorite_count`：

- 添加收藏：锁胶囊、插入 `favorites`、递增 `capsules.favorite_count`。
- 取消收藏：删除 `favorites`、递减计数，计数不低于 0。
- PostgreSQL 用行锁防并发计数漂移。
- SQLite 依赖单写事务。

不要把计数改成“查询时 COUNT”，因为 spec 明确要求 denormalized `favorite_count` 被维护。

### 6.4 schema 不是应用启动职责

`run` 不调用 Maven migration、Flyway、Liquibase 或 `scripts/db`。schema 只由仓库级 `./scripts/db init/reset/seed` 维护；应用只消费准备好的数据库。

## 7. 服务端架构：Controller -> Service -> Repository

### 7.1 JSON API 统一外壳

JSON 控制器抛出的 `ApiException` 由 `GlobalExceptionHandler` 转成契约外壳：

```json
{
  "success": false,
  "data": null,
  "message": "...",
  "errorCode": "..."
}
```

成功响应也保持 `{ success, data, message, errorCode }`。204 接口按契约返回空 body。

### 7.2 鉴权：`CookieTokenFilter`

契约要求 Bearer token，SSR 页面适合 httpOnly cookie。桥接规则是：

```text
若请求路径是 /api/v1/*
且没有 Authorization 头
且带 ht_access cookie
则包装请求，让 getHeader("Authorization") 返回 Bearer <ht_access>
```

因此：

- 契约测试带真实 Bearer 时不受影响。
- 无鉴权用例仍然返回 401。
- 浏览器同源 fetch 自动带 cookie，也能复用 JSON 控制器。

`CookieAuthService` 负责 SSR 页面读写 cookie，并只在 access 缺失或过期时用 refresh token 轮换，避免每次导航都 refresh 导致 token family 被误吊销。

### 7.3 服务层边界

业务规则在 `service/*`：

- `AuthService`：注册、登录、refresh rotate、登出、改密。
- `CapsuleService`：创建、按码查询、我的胶囊、删除自己的胶囊。
- `PlazaService`：公开广场列表、排序、过滤、搜索、详情。
- `FavoriteService`：收藏和取消收藏、收藏列表、计数维护。
- `UserService`：资料更新。
- `CapsuleSuggestionService` / `CapsuleRecommendationService`：AI 生成和推荐。
- `LlmClientService`：外部 LLM HTTP 调用及结构化日志。

Controller 不直接访问 Repository，模板也不直接查数据库。

## 8. 客户端交互：HTMX + `static/js/app.js`

### 8.1 HTMX 是什么，以及本实现为什么用它

HTMX 是一个 ~14 KB 的库（无构建步骤、无 npm），允许用 HTML 属性（`hx-get`、`hx-post`、`hx-target`、`hx-swap`…）触发 AJAX 请求，并把响应 HTML 插入 / 替换页面指定区域。整个页面不需要客户端路由，也不需要 Virtual DOM——服务端返回 HTML 片段，浏览器直接更新 DOM。

在「5 个全栈」里，Next / Nuxt 的局部刷新靠 React / Vue 状态驱动客户端组件重渲；Spring MVC 版刻意选 HTMX，展示另一条路：**服务端渲染 + HTML-over-the-wire**，客户端 JS 降到最小。Rails 版用 Hotwire（Turbo）走同一思路，两者并排读价值很高。

### 8.2 广场搜索：HTMX 局部刷新

广场搜索输入框与排序按钮都带 HTMX 属性，触发时向服务端请求 HTML 片段并替换页面里的 `#plaza-grid` 区域：

```html
<!-- plaza.html：搜索输入框 -->
<input name=”q”
       hx-get=”/ui/plaza/grid”
       hx-trigger=”input changed delay:300ms, search”
       hx-target=”#plaza-grid”
       hx-sync=”this:replace”>

<!-- 排序按钮（热门） -->
<button hx-get=”/ui/plaza/grid”
        hx-target=”#plaza-grid”
        hx-include=”[name='q']”
        hx-vals='{“sort”:”hot”}'>🔥 热门</button>
```

关键属性说明：

| 属性 | 作用 |
|---|---|
| `hx-get=”/ui/plaza/grid”` | 触发时向该 URL 发 GET 请求 |
| `hx-trigger=”input changed delay:300ms, search”` | `input` 事件（300ms 防抖）或 `search` 事件都会触发 |
| `hx-target=”#plaza-grid”` | 把响应 HTML 插入 `id=”plaza-grid”` 的元素 |
| `hx-sync=”this:replace”` | 若有正在进行的同名请求则取消前者，保证只执行最新一次 |
| `hx-include=”[name='q']”` | 把页面上 `name=”q”` 的元素值一并提交（排序按钮不含搜索框，需要显式包含） |
| `hx-vals='{“sort”:”hot”}'` | 追加额外参数（不在 form/input 里的字段） |

服务端：`FragmentController.plazaGrid()` 处理 `GET /ui/plaza/grid`，把结果存进 `Model`，返回 `”fragments/plaza-grid :: grid”`——这是 Thymeleaf 片段语法，只渲染 `plaza-grid.html` 里 `th:fragment=”grid”` 的那一块 HTML，不包含完整页面结构。

> **Playwright 陷阱**：`hx-trigger=”input changed delay:300ms, search”` 的 `input` 覆盖了 Playwright `fill()` 派发的 `input` 事件。若只写 `keyup`，自动化测试填值后不会触发搜索。

### 8.3 与 Hotwire（Turbo Frame）的对照

Rails 版的广场搜索用 Turbo Frame：

```html
<!-- Rails: index.html.erb -->
<turbo-frame id=”plaza-grid”>
  <%= render partial: “public/plaza_grid” %>
</turbo-frame>

<input data-turbo-action=”replace” ...>
```

两种方案都是「服务端返回 HTML 替换页面局部区域」，但机制不同：

| 维度 | HTMX | Turbo Frame |
|---|---|---|
| 触发方式 | `hx-*` 属性 | `<turbo-frame>` + 表单/链接 target |
| 响应格式 | 任意 HTML 片段 | 包含同 id `<turbo-frame>` 的完整响应 |
| 同步控制 | `hx-sync` 属性 | Turbo 自动管理 |
| JS 大小 | ~14 KB | ~60 KB（含 Turbo Drive、Stream） |
| Rails 集成 | 框架无关 | Rails 官方支持 |

### 8.4 收藏切换为什么用同步 XHR

UI 冒烟有路径”点收藏后立刻导航到 `/me/favorites`”。如果收藏请求还在飞，下一页 SSR 查询可能先执行，导致刚收藏的卡片不出现。

Spring MVC 版保留事务和行锁来维护 `favorite_count`，收藏写比普通读慢一点，所以已登录收藏按钮用同步 `XMLHttpRequest` 调 `/ui/capsules/{id}/favorite-toggle`，等数据库提交后再允许后续导航。匿名点击在浏览器侧 `confirm` 后跳登录，不发请求。

服务端 `FragmentController.favoriteToggle()` 返回 `{“favorited”: true, “favoriteCount”: 3}` JSON，客户端 `app.js` 收到后直接更新按钮图标和计数显示——这里不走 HTMX，直接用原生 XHR 是为了同步等待响应。

### 8.5 AI 与资料页直接调 JSON API

创建页的 AI 推荐/生成、资料页保存和改密都直接 `fetch /api/v1/*`。这让它们与契约端点保持同一行为，也便于 UI smoke 用路由 mock 验证 AI 分支。浏览器发请求时不带 `Authorization` 头，`CookieTokenFilter` 会把 `ht_access` cookie 注入为 `Bearer` 头，复用同一套 Bearer 鉴权控制器。

## 9. 样式：Tailwind v4 + 设计令牌

样式入口是 `tailwind/app.css`，构建产物是 `src/main/resources/static/css/app.css`。

原则与 Next/Nuxt 一致：

- 复用 `spec/styles` 的设计令牌。
- 复用 `cy-*` 组件类。
- 不在模板里写硬编码颜色或间距。
- Node 只用于 Tailwind CLI 构建，运行期不依赖 Node。

`run`/`build` 会尽量生成最新 CSS；无 npm 时使用已提交的 `app.css` 作为兜底。

## 10. 与 Next/Nuxt 的并排对比

| 关注点 | Next/Nuxt | Spring MVC |
|---|---|---|
| 页面路由 | 文件系统路由 | `@Controller` + `@GetMapping` |
| API 路由 | `route.ts` / `server/api/*.ts` | `@RestController` |
| 页面渲染 | React/Vue 组件 | Thymeleaf 模板 |
| 局部交互 | Client Component / Vue + store | HTMX HTML 片段 + 原生 JS |
| 数据层 | Drizzle + SQL schema | Spring Data JPA + Hibernate JdbcType |
| 鉴权桥 | cookie / server helper | `CookieTokenFilter` cookie -> Bearer |
| 样式 | Tailwind v4 + tokens | Tailwind v4 CLI + tokens |
| schema 生命周期 | `scripts/db` | `scripts/db` |

关键差异：Next/Nuxt 的 UI 大多在客户端组件里组织状态；Spring MVC 的 UI 主要由服务端模板渲染，浏览器只承担局部增强。

## 11. 常见改动指南

- 新增 JSON API：在 `web/*Controller.java` 加 mapping，业务放 `service/*`，错误抛 `ApiException`，保持 envelope。
- 新增页面：在 `web/view/*ViewController.java` 加 route，准备 `Model`，新建 `templates/*.html`。
- 新增局部刷新：优先放 `FragmentController`，返回 Thymeleaf fragment；只有天然 JSON 的交互才放 `app.js` fetch API。
- 修改 schema：先改 `spec/db` 和仓库级 `scripts/db`，再同步 Entity、Repository、跨库 JdbcType。
- 修改收藏：必须维护事务内 `favorite_count`，不要绕过 `FavoriteService`。
- 修改鉴权：同时考虑 Bearer 契约和 cookie SSR；不要让浏览器 JS 读取 token。
- 修改样式：改 `tailwind/*.css` 或模板类名，运行 `./build` 更新 `static/css/app.css`。
- 修改 LLM：保持 `LLM request` / `LLM response` / `LLM error` 结构化日志字段。

## 12. 学到这里之后

读 Spring MVC 版时，把它当成“传统服务端模板全栈如何对齐现代 API 契约”的样本：

- HTTP 契约仍是黑盒 `/api/v1/*`。
- 页面只是同一服务层的另一种表现形式。
- 双数据库差异被压在基础设施层。
- HTMX 只接管适合 HTML 片段的交互。
- 原生 JS 只处理浏览器独有的状态和 JSON API 调用。

这套边界清楚后，再横向看 Rails 和 Laravel，会发现三者都在实现同一目标，只是分别用 Thymeleaf/HTMX、Hotwire、Blade/Alpine 表达各自框架的本地习惯。
