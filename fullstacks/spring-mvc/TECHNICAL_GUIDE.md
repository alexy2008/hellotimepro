# HelloTime Pro Spring MVC 全栈技术手册与代码导读（2.0）

> 面向：读完 `docs/01-requirements.md`、`docs/02-design.md`、`docs/05-upgrade-2.0.md` 后，想理解 Spring MVC 全栈版如何在严格对齐 2.0 API 契约与双皮肤设计系统的前提下，用 **Spring MVC + Thymeleaf + HTMX + 渐进增强原生 JS** 做出地道 Java SSR 全栈实现的读者。

## 1. 技术选型与 2.0 设计特色

Spring MVC 版运行在 **7179** 端口，同一个 Spring Boot 3 进程同时提供两套同源入口：

| 入口 | 消费者 | 鉴权 | 输出 |
|---|---|---|---|
| `/api/v1/*` | 黑盒契约测试、浏览器 `fetch` | `Authorization: Bearer`（浏览器同源请求由 `CookieTokenFilter` 桥接） | JSON envelope |
| 页面与 `/ui/*` | 浏览器导航、HTMX 局部刷新 | httpOnly Cookie（`ht_access` / `ht_refresh`） | Thymeleaf 整页 HTML / HTML 片段 |

在 5 套全栈实现里，Spring MVC 与 Rails（Hotwire）、Laravel（Blade + Alpine）属于「服务端模板驱动」阵营，与 Next / Nuxt 的「SPA 框架长出服务端」形成对照：

- **业务地基统一**：领域实体、JPA Repository、Service 层、跨库 `JdbcType`、HS256 JWT + Refresh Token 家族追踪与 `backends/spring-boot` 保持同构，API 契约与 `spec/api/openapi.yaml` 2.0.0 逐字对齐。
- **双皮肤服务端渲染（无 Tailwind）**：不再使用 Tailwind CLI；静态资源直接挂载仓库 `spec/styles`（`base.css` → `paper/` → `amber/` → `shell.css`）、`spec/avatars/v2`、`spec/icons` 以及 `@fontsource` 自托管字体，自定义胶水样式 `static/css/app.css` 仅使用语义令牌、不含任何颜色字面量。
- **HTML-over-the-wire 局部刷新**：广场搜索 / 筛选 / 排序 / 分页、到点后自动揭晓正文、个人中心「加载更多」均由 `FragmentController` 返回 Thymeleaf 片段，通过 HTMX 或轻量 fetch 替换/追加 DOM。
- **原生 JS 负责纯浏览器仪式与状态**：`app.js` 负责双皮 DOM 唯一钩子同步（`syncSkinDom`）、View Transition 换肤与明暗切换、琥珀星空画布、8 格胶囊码输入、倒计时与确认框；`create.js` 负责分用户 `sessionStorage` 草稿、AI 推荐与打字机代笔、时笺对数时间标尺 + 长按封缄、琥珀星轨时钟与两步揭晓。

## 2. 目录结构与请求流向

```text
fullstacks/spring-mvc/
  README.md
  TECHNICAL_GUIDE.md
  pom.xml                                  # Spring Boot 3.4 + JPA + Thymeleaf + PG/SQLite 驱动
  package.json                             # 仅安装 @fontsource 自托管字体，运行期不依赖 Node
  run / build / test                       # 构建可执行 jar / 启动 7179 / SQLite 单元与集成测试
  src/main/java/com/hellotimepro/springmvc/
    HelloTimeProApplication.java
    config/
      AppProperties.java                   # JWT / LLM / serviceVersion=2.0.0 配置映射
      WebConfig.java                       # CookieTokenFilter 注册；映射 spec/styles、avatars/v2、icons、@fontsource
    db/
      CrossDbUuidJdbcType.java             # PG 原生 uuid / SQLite 32 位 hex TEXT
      CrossDbOffsetDateTimeJdbcType.java   # PG timestamptz / SQLite ISO-8601 TEXT
    domain/
      UserEntity.java · CapsuleEntity.java · FavoriteEntity.java · FavoriteId.java · RefreshTokenEntity.java
    repository/
      UserRepository.java · CapsuleRepository.java · FavoriteRepository.java · RefreshTokenRepository.java
    service/
      AuthService.java · AuthContext.java · SecurityService.java
      CapsuleService.java · CapsuleIds.java · MapperService.java
      PlazaService.java · FavoriteService.java · UserService.java
      AvatarService.java                   # 读取 spec/avatars/v2/catalog.json + 内联 SVG 路径
      CapsuleSuggestionService.java · CapsuleRecommendationService.java · LlmClientService.java
      HealthStackService.java              # /api/v1/health 与 /about 页技术栈信息
    web/
      HealthController.java                # GET /api/v1/health（version 固定 2.0.0）
      AuthController.java                  # /api/v1/auth/*（同时同步/清理 httpOnly Cookie）
      CapsuleController.java               # POST /api/v1/capsules · GET /code/{code} · DELETE /{id}
      PlazaController.java                 # GET /api/v1/plaza/capsules · /stats
      MeController.java                    # GET /api/v1/me · /stats · /capsules · PATCH /me · POST /password
      FavoriteController.java              # GET / POST / DELETE /api/v1/me/favorites
      CapsuleSuggestionController.java     # POST /api/v1/capsules/suggest
      CapsuleRecommendationController.java # GET /api/v1/capsules/recommendations
      CookieTokenFilter.java               # /api/v1/*（排除 /auth/*）Cookie -> Bearer 鉴权桥
      GlobalExceptionHandler.java          # 仅作用于 @RestController，返回 JSON envelope
      ApiException.java · ErrorCode.java
      view/
        PublicViewController.java          # / · /open · /capsules/{code}（含 /c/{code} 兼容跳转）· /about
        AuthViewController.java            # /login · /register · /logout
        CreateViewController.java          # /create
        MeViewController.java              # /me -> /me/created · /me/{tab}
        FragmentController.java            # /ui/plaza/grid · /overview · /capsules/{code}/opened · /me/{kind}/rows
        ViewErrorController.java           # 实现 ErrorController：页面路由返回双皮 404，/api/* 返回 JSON 错误
        CookieAuthService.java             # httpOnly Cookie 解析/轮换 + 单请求结果缓存
        GlobalModelAttributes.java         # 向所有视图注入登录态、头像表、技术栈、导航键
        Fmt.java                           # 模板助手 Bean（@fmt）：48 枚线性 SVG 图标、FNV-1a OKLCH 专属色、日期与倒计时
  src/main/resources/
    application.yml                        # 默认端口 7179、Thymeleaf、双库连接模板
    templates/
      plaza.html · open.html · capsule-detail.html · create.html
      login.html · register.html · me.html · about.html · not-found.html
      fragments/
        layout.html                        # 公共 head（首帧脚本 + spec/styles）、双皮页头/页脚/底栏、Toast、确认框
        parts.html                         # 线性图标、内联头像、桑皮火漆印、进度条、分段器、收藏按钮、8 格码输入
        cards.html                         # 时笺（信笺卡片）/ 琥珀（星匣卡片）胶囊卡
        plaza-grid.html                    # 广场筛选条 + 排序 + 网格 + 分页（供首屏与 HTMX 共用）
        capsule-detail.html                # 胶囊详情正文/封印态（供首屏与到点揭晓片段共用）
        me-rows.html                       # 个人中心胶囊列表行（供首屏与「加载更多」片段共用）
    static/
      css/app.css                          # 极简皮肤显隐与胶水样式（零色值字面量）
      js/app.js                            # syncSkinDom、换肤/明暗、星空画布、HTMX 广场、详情倒计时、个人中心、收藏
      js/create.js                         # 创建页草稿、AI 推荐与打字机、时笺标尺/日历/长按封缄、琥珀星轨时钟、回执
      js/htmx.min.js
      logo.svg
  src/test/java/com/hellotimepro/springmvc/
    SmokeTest.java                         # 全链路 API + SSR 404 + SQLite 删胶囊不依赖外键级联回归测试
    service/CapsuleServiceTest.java        # 非法 UUID -> 422、10 历年闰日收紧等边界测试
```

请求流向：

```text
浏览器页面请求（/、/open、/capsules/{code}、/create、/me/* ...）
  -> CookieAuthService（单请求缓存，必要时静默 refresh 轮换）
  -> web/view/*ViewController -> service/* -> repository/*
  -> Thymeleaf templates/*.html（输出双皮 SSR 结构）
  -> 浏览器首帧脚本设置 <html data-skin data-theme>，syncSkinDom() 同步唯一测试钩子

HTMX 局部刷新（/ui/plaza/grid、/ui/capsules/{code}/opened、/ui/me/{kind}/rows）
  -> FragmentController -> service/*
  -> Thymeleaf fragments/*.html :: <fragment>
  -> HTMX swap + htmx:afterSwap 触发 syncSkinDom()

JSON 契约与浏览器 fetch（/api/v1/*）
  -> CookieTokenFilter（无 Authorization 头且非 /api/v1/auth/* 时从 Cookie 注入 Bearer）
  -> web/*Controller -> service/* -> repository/*
  -> GlobalExceptionHandler（仅限 @RestController）返回统一 JSON envelope
```

## 3. 运行与验证

数据库表结构与演示数据由仓库级 `./scripts/db` 管理，本实现的 `run` 脚本只负责构建/启动服务，不建表、不迁移、不写种子数据。

```bash
# 仓库根目录：经 dev-manager 启动（自动注入数据库与 LLM 配置）
./scripts/db init
./scripts/hello start spring-mvc                   # PostgreSQL（默认）
DB_DRIVER=sqlite ./scripts/hello start spring-mvc  # SQLite

# 本目录直接构建 / 测试 / 运行
cd fullstacks/spring-mvc
./build   # npm install（如缺 @fontsource）+ mvn package（生成可执行 jar）
./test    # 临时 SQLite 库跑 JUnit 单元测试与集成冒烟
./run     # 若源码有改动则增量打包，直接启动可执行 jar（端口 7179）
```

> `run` 改为启动 `target/spring-mvc-fullstack-2.0.0.jar`（仅在源码或 `pom.xml` 比 jar 新时自动重新打包），省去每次 `mvn spring-boot:run` 的冷启动编译开销，端口就绪通常只需 1–2 秒。

完整 2.0 验收命令：

```bash
./verification/scripts/verify-design-tokens.sh spring-mvc
./verification/scripts/verify-contract.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh spring-mvc
./verification/scripts/verify-ui-smoke.sh spring-mvc
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh spring-mvc
```

## 4. 2.0 双皮肤 SSR 架构：`spec/styles` + `syncSkinDom`

### 4.1 零 Tailwind、零色值字面量

`WebConfig.addResourceHandlers()` 直接把仓库级静态资源和本目录字体映射到固定前缀：

- `/static/styles/**` → `../../spec/styles/`
- `/static/avatars/**` → `../../spec/avatars/v2/`
- `/static/icons/**` → `../../spec/icons/`
- `/static/fonts/**` → `./node_modules/@fontsource/`

`layout.html` 按契约顺序引入：
1. `@fontsource/noto-serif-sc`、`@fontsource/cormorant-garamond`、`@fontsource/ibm-plex-mono`（字体自托管，不依赖外部 CDN）；
2. `base.css` → `paper/tokens.css` + `paper/components.css` → `amber/tokens.css` + `amber/components.css` → `shell.css`；
3. 本实现唯一的自定义样式 `static/css/app.css`（仅控制 `[data-skin-view]` 显隐、`.skin-slot { display: contents; }` 和 `.list-more` 间距，不含任何色值字面量）。

### 4.2 为什么采用双皮 SSR 插槽 + `syncSkinDom`

Playwright 冒烟和普通浏览器都会把皮肤偏好存在 `localStorage['hellotime.skin']`（首次访问时服务端拿不到 Cookie）。为了同时满足：
1. **真正服务端渲染且无首帧闪屏（FOUC）**；
2. **切皮肤时不重新拉页面、表单输入与草稿不丢失**；
3. **严格遵守 `spec/ui/testids.md §1.4`：页面上任何时刻不能存在两个同名的 `data-testid` 或 `[data-code-cell]`（哪怕其中一个被隐藏）**；

模板中结构不同的皮肤视图被包在 `<div class="skin-slot" data-skin-view="paper">` 与 `<div class="skin-slot" data-skin-view="amber">` 内：

- `<head>` 顶部的内联首帧脚本在绘制前把 `localStorage` 中的 `hellotime.skin` / `hellotime.theme` 写入 `<html data-skin data-theme>`；
- `app.css` 立刻隐藏非当前皮肤的 `[data-skin-view]`，实现零闪屏；
- `<body>` 末尾的 `app.js` 立即同步执行 `syncSkinDom()`：把非激活皮肤子树里的 `data-testid` / `data-code-cell` 暂存到 `data-ht-testid` / `data-ht-code-cell` 并移除原属性，把激活皮肤子树的属性还原。每次切换皮肤或 HTMX 完成 `htmx:afterSwap` 后再次调用 `syncSkinDom()`；
- 对跨皮肤需要保留状态的输入（登录 / 注册表单、8 格胶囊码、创建页标题/正文/公开性/开启时间），切皮肤时通过共享状态或字段镜像实时同步到激活皮肤的控件，确保切换后半截胶囊码、表单内容与路由完整保留。

### 4.3 皮肤与明暗切换动效

- **切皮肤**：设置 `document.documentElement.dataset.skinDir = (next === 'amber' ? 'to-amber' : 'to-paper')`，在支持 View Transition 且未开启 `prefers-reduced-motion: reduce` 时执行模糊淡入过渡；开启减少动效时立即切换（满足 X1 契约）。
- **切明暗**：记录点击坐标 `--theme-x` / `--theme-y`，经 View Transition 圆形扩散；同时为琥珀皮肤的星空画布（`#amber-sky`）重绘星点。

## 5. 服务端视图、HTMX 片段与渐进增强 JS 分工

### 5.1 路由总览

| 路由 | 控制器 | 说明 |
|---|---|---|
| `/` | `PublicViewController` | 广场概览（来自 `PlazaService.plazaStats`）、就地 8 格输码、胶囊广场首屏 |
| `/open` | `PublicViewController` | 凭码开启页；已登录时服务端直接拼出「我封存过的胶囊」 |
| `/capsules/{code}` | `PublicViewController` | 胶囊详情（未开启显示倒计时并隐藏正文，查无此码显示查无此胶囊）；`/c/{code}` 302 重定向到此 |
| `/create` | `CreateViewController` | 写一枚胶囊；匿名访问 302 到 `/login?redirect=%2Fcreate` |
| `/login` · `/register` · `/logout` | `AuthViewController` | 账号登录注册；已登录再访问 `/login` 或 `/register` 会安全跳走，不破坏当前会话 |
| `/me` · `/me/{tab}` | `MeViewController` | `/me` 跳转 `/me/created`；支持 `created` / `favorites` / `profile` 三页签，匿名带 `?redirect=` 跳登录 |
| `/about` | `PublicViewController` | 关于页：后端 + 前端（Thymeleaf / HTMX / ES2023）技术栈卡片与系统说明 |
| 未知路径 | `ViewErrorController` | 页面路由返回 HTTP 404 与双皮 `not-found.html`；`/api/*` 返回统一 JSON 404 envelope |

### 5.2 HTMX 片段接口（`FragmentController`）

| 端点 | 用途 | 响应方式 |
|---|---|---|
| `GET /ui/plaza/grid` | 广场搜索、筛选、排序、分页 | 返回 `fragments/plaza-grid :: grid`，HTMX 替换 `#plaza-grid` |
| `GET /ui/plaza/overview` | 广场概览数字局部刷新 | 返回 `fragments/plaza-grid :: overview` |
| `GET /ui/capsules/{code}/opened` | 倒计时归零后向服务端确认揭晓 | 服务端仍未到点时返回 **409**（客户端继续轮询）；服务端确认 `isOpened=true` 后返回 `fragments/capsule-detail :: body` 并原地替换 |
| `GET /ui/me/{kind}/rows` | 个人中心「加载更多」（每页 20 条） | 返回 `fragments/me-rows :: rows` 并附 `X-Total-Count` 头；前端按 `data-capsule-id` 去重追加，解决删除条目后偏移漂移导致漏项或重复 |

### 5.3 客户端 JS 边界（`app.js` / `create.js`）

- **`app.js`**：
  - `syncSkinDom()` 与跨皮状态镜像；
  - 统一 `Toast` 与 `ConfirmDialog`（遵循 X6 / X7 契约，匿名点击「创建」或「收藏」先弹确认框，确认后带 `?redirect=` 跳登录）；
  - 8 格胶囊码组件（支持键盘输入、粘贴清洗、回退、**满 8 位时再键入自动覆写**、以及首页就地校验提示 / 开启页满 8 位自动跳转）；
  - 收藏按钮：改为 `await fetch('/api/v1/me/favorites', ...)` 完成后再切换 `aria-pressed` 与计数（不再使用 1.x 的同步 XHR，也避免乐观更新导致未落库就跳转 `/me/favorites`）；
  - 广场搜索/筛选交互：输入 300ms 防抖、`/` 快捷键聚焦搜索框、HTMX 请求失败时展示重试按钮；
  - 详情页逐秒倒计时与到点轮询 `/ui/capsules/{code}/opened`；
  - 个人中心：删除胶囊确认框、分页加载更多与统计数字同步、资料修改（无改动提示，成功后同步更新页头昵称/头像）、改密前端一致性拦截与改密后跳登录。
- **`create.js`**：
  - 按当前用户 ID 分槽的 `sessionStorage` 草稿（换账号登录互不串扰，切皮肤不丢）；
  - AI 推荐主题异步拉取（返回空或失败时静默隐藏，支持「换一批」与点击填入）、AI 代笔打字机（用户手动编辑立刻中断打字机，代笔失败原样保留正文）；
  - **时笺皮肤**：对数时间标尺 + 年月日历 + 1150ms 指针/键盘空格长按封缄（定时器驱动，支持后台标签与减少动效快速完成）；
  - **琥珀皮肤**：星轨时钟 DateTimePicker（角度解缠绕防跨 0° 跳变、快捷年份、两步揭晓平滑滚动）；
  - 封存成功后就地渲染对应皮肤的回执卡片（8 位胶囊码、一键复制、去查看详情、再写一枚）。

## 6. 后端 API 2.0 与数据层要点

### 6.1 2.0 契约对齐细节

- **新增统计端点**：`GET /api/v1/plaza/stats`（返回全广场与当前搜索词下的统计与时间跨度）与 `GET /api/v1/me/stats`（返回当前用户创建的胶囊数、已开启数、收藏数）。
- **收藏规则放宽**：2.0 起不再限制必须公开或不能收藏自己的胶囊；`FavoriteService.addFavorite` / `removeFavorite` 均先用 `CapsuleIds.parse()` 校验 UUID，并在事务内加锁更新 `capsules.favorite_count`。
- **严格 UUID 校验（`CapsuleIds`）**：Java 标准 `UUID.fromString("1-1-1-1-1")` 会接受非标准短段。`CapsuleIds.parse()` 先做标准 36 位正则匹配，非法直接返回 **422 `VALIDATION_ERROR`**，合法但查不到返回 **404**（取消收藏幂等返回 **204**）。
- **开启时间边界（`CapsuleService.validateOpenAt`）**：要求严格晚于当前时间 + 60 秒，上限按 UTC 10 个历年计算（2 月 29 日封存时 10 年后收紧为 2 月 28 日）。
- **搜索词与 Unicode 计数（`PlazaService`）**：按 Unicode 码点计数（`q.codePointCount(...) <= 50`），转义 `\`, `%`, `_` 并配合 JPQL `escape '\\'` 防止通配符注入；广场查询条件通过 `exists (select 1 from UserEntity u0 where u0.id = c.ownerId)` 过滤孤儿记录。
- **异常处理隔离（`GlobalExceptionHandler` + `ViewErrorController`）**：`GlobalExceptionHandler` 限定 `@RestControllerAdvice(annotations = RestController.class)`，只拦截 JSON API 控制器；未知页面路径交由 `ViewErrorController` 返回双皮 404 页面，不再被全局异常处理吞成 500 JSON。

### 6.2 鉴权桥接与单请求缓存

- `CookieTokenFilter` 仅在请求路径匹配 `/api/v1/*`（且排除 `/api/v1/auth/*`）、无 `Authorization` 请求头、存在 `ht_access` 或可刷新 `ht_refresh` Cookie 时注入 `Authorization: Bearer ...`，契约测试自带 Bearer 时完全不受影响。
- `CookieAuthService` 把本次 HTTP 请求的鉴权结果缓存在 `HttpServletRequest` attribute 中：同一次 SSR 请求里 `GlobalModelAttributes` 与具体 `*ViewController` 都会读取当前用户，单请求缓存保证即便 access 刚过期也只会触发一次 refresh token 轮换，绝不会误触家族吊销。
- `AuthController` 的注册 / 登录 / 刷新同步写回 httpOnly Cookie，登出与 `MeController.changePassword` 会清理 Cookie，确保浏览器通过 `/api/v1/*` 登录后刷新 SSR 页面仍保持登录态。

### 6.3 PostgreSQL / SQLite 双库兼容

- **自定义 Hibernate `JdbcType`**：`CrossDbUuidJdbcType` 与 `CrossDbOffsetDateTimeJdbcType` 封装 PostgreSQL 原生 `uuid`/`timestamptz` 与 SQLite `TEXT`（32 位无横线 UUID / ISO-8601 字符串）的双向转换。
- **行锁与并发写**：
  - PostgreSQL：`CapsuleRepository.findForMutation(id, true)` 使用 `PESSIMISTIC_WRITE`（`SELECT ... FOR UPDATE`），收藏、取消收藏、删除胶囊均按「先锁胶囊行 → 再操作收藏表」的顺序执行，防止 `favorite_count` 漂移或死锁。
  - SQLite：连接串附加 `?transaction_mode=IMMEDIATE` 序列化写事务；删除胶囊时 `CapsuleService.deleteOwn` 显式调用 `favoriteRepository.deleteByIdCapsuleId(id)`（`@Modifying @Query` 批量删除），即使 SQLite 连接未开启 `PRAGMA foreign_keys = ON` 也不会遗留孤儿收藏。
- **LLM 日志规范**：`LlmClientService` 在请求前 / 成功后 / 失败时按统一格式输出 `LLM request`、`LLM response`、`LLM error` 结构化日志，并透传 `User-Agent` 与进程级 `x-opencode-session`。

## 7. 常见改动指南

- **新增或修改 JSON API**：在 `web/*Controller.java` 定义映射，业务逻辑放 `service/*`，参数校验放 `dto/Dtos.java` 或 `CapsuleIds`，错误统一抛 `ApiException`。
- **新增或修改页面**：在 `web/view/*ViewController.java` 准备 `Model`，模板放 `templates/`；结构因皮肤而异的区块分别放在 `data-skin-view="paper"` 与 `data-skin-view="amber"` 下，共用控件抽到 `templates/fragments/parts.html`。
- **新增 HTMX 片段**：在 `FragmentController` 返回 `fragments/... :: <name>`；如果片段包含测试钩子或双皮结构，`app.js` 会在 `htmx:afterSwap` 自动重新运行 `syncSkinDom()`。
- **修改样式**：优先复用 `spec/styles` 中已有类名；若确需在 `static/css/app.css` 增补布局胶水，只能使用语义令牌，改完运行 `./verification/scripts/verify-design-tokens.sh spring-mvc` 确认通过。
- **调整双库持久化**：不要绕过 `CapsuleRepository.findForMutation` 和 `FavoriteService` 直接改 `favorite_count`；改动后务必分别用 PostgreSQL 和 SQLite 跑完单测、契约与 UI 冒烟。
