# HelloTime Pro Laravel 全栈技术手册与代码导读（2.0）

本文说明 HelloTime Pro 2.0 的 Laravel 全栈实现如何在完全对齐 `spec/`（OpenAPI 2.0.0、双库 schema、双皮肤设计令牌与测试钩子）的前提下，保持 **Laravel 13 + Eloquent ORM + Blade SSR + Alpine.js 3** 的地道 PHP 全栈写法。

## 1. 技术选型与 2.0 架构特色

Laravel 版运行在 **7182** 端口，是「服务端框架 + 轻量渐进增强」的代表：

- **显式集中的路由边界**：`routes/api.php` 定义 `/api/v1/*` JSON 契约，`routes/web.php` 定义 SSR 页面路由。
- **薄控制器 + 共享服务层**：`HelloTimeApiController` 与 `Web\{Page,Auth}Controller` 只做 HTTP 边界，所有业务规则集中在 `app/Services/*`，确保 JSON 接口与页面首屏数据完全同源、行为一致。
- **Eloquent ORM + 跨库封装**：数据层全部走 `app/Models/*` 模型、关系与自定义 `CrossDbBoolean` Cast，PostgreSQL 与 SQLite 的格式差异集中收敛在 `app/Support/CrossDb.php`。
- **Blade 双皮肤 SSR + Alpine.js 3 状态隔离**：
  - 每个页面模板（`resources/views/pages/*.blade.php`）在最外层声明共享的 Alpine `x-data`，再通过 `<template x-if="$store.ui.skin === 'paper|amber'">` 按当前皮肤只挂载一套 DOM。
  - 「时笺」与「琥珀」各自保留完整的原生视觉与交互体验（时笺的时间标尺 + 日历 + 长按火漆 + 折纸信封启封；琥珀的星空粒子 + 十年星轨机械时钟 + 环形进度舱），切换皮肤时状态、草稿、搜索与输码全部无损延续。
- **零 Tailwind、零前端构建链**：样式原样同步 `spec/styles` 2.0（`base.css` → `paper/*` → `amber/*` → `shell.css`），`@fontsource` 字体与 `alpine.min.js` 通过 `scripts-sync-assets.sh` 同步到 `public/`，无需 Vite 或 Webpack。

同一个进程同时服务两类请求：

| 入口 | 消费者 | 鉴权方式 | 输出 |
|---|---|---|---|
| `/api/v1/*` | 黑盒契约测试、浏览器 `fetch` | `Authorization: Bearer` 或同源 `ht_access` cookie | 标准 JSON Envelope（204 无 body） |
| Web 页面路由 | 浏览器导航 | `ht_access` httpOnly cookie（未登录 302 跳转登录） | Blade HTML + `window.__HT_INIT__` 首屏数据 |

## 2. 整体目录地图

```text
fullstacks/laravel/
├── README.md / TECHNICAL_GUIDE.md
├── run / build / test / scripts-sync-assets.sh
├── composer.json / package.json
├── bootstrap/app.php                                # 注册 routes、CORS 与 cookie 加密白名单
├── config/database.php                              # PostgreSQL 与 SQLite（busy_timeout + IMMEDIATE）
├── routes/
│   ├── api.php                                      # /api/v1/*（含 2.0 的 plaza/stats、me/stats）
│   └── web.php                                      # /, /open, /capsules/{code}, /create, /login, /register, /me/*, /about, fallback 404
├── app/
│   ├── Http/Controllers/
│   │   ├── Api/V1/HelloTimeApiController.php        # 统一 api() 包装 + httpOnly auth cookie 同步
│   │   └── Web/
│   │       ├── PageController.php                   # 公开页/受保护页首屏取数 + 服务端 302 守卫
│   │       └── AuthController.php                   # /login, /register（已登录 302 离开）, POST /logout
│   ├── Models/
│   │   ├── User.php / Capsule.php / Favorite.php / RefreshToken.php
│   │   └── Concerns/HasCrossDbKey.php               # 非自增字符串主键 + 跨库 UUID 生成
│   ├── Casts/CrossDbBoolean.php                     # 屏蔽 PostgreSQL 't'/'f' 与 SQLite 0/1 差异
│   ├── Providers/AppServiceProvider.php             # SQLite Unicode LOWER() + 全局 View::composer
│   ├── Services/
│   │   ├── AuthService.php                          # 注册/登录/refresh 轮换与家族吊销/登出/改密/限流
│   │   ├── CapsuleService.php                       # 创建（10日历年上限）/按码查询/我的胶囊/我的统计/删胶囊连带删收藏
│   │   ├── PlazaService.php                         # 公开列表/详情/统计（字面 LIKE 转义、空集归零）
│   │   ├── FavoriteService.php                      # 2.0 无限制收藏、幂等取消、并发锁顺序
│   │   ├── ProfileService.php                       # 资料更新（409 附 field details）
│   │   ├── SuggestionService.php / LlmClient.php    # AI 推荐与代笔 + 本地模板兜底 + 结构化日志
│   │   ├── HealthService.php                        # version=2.0.0 + 技术栈元数据
│   │   └── AvatarCatalog.php                        # 读取 spec/avatars/v2/catalog.json 与内联 SVG glyph
│   ├── Support/
│   │   ├── CrossDb.php                              # UUID/时间戳/布尔换算、addCalendarYears()、SQLite 双格式匹配
│   │   ├── Mapper.php                               # Eloquent 模型 → 2.0 DTO（显式输出 null、批量防 N+1）
│   │   ├── Validation.php                           # Unicode 码点校验与字段边界规则
│   │   ├── JwtCodec.php / Formatter.php / UiHelper.php
│   └── Exceptions/{ApiError,LlmException}.php
├── resources/views/
│   ├── layouts/app.blade.php                        # 首帧防闪脚本 + 字体/样式 + #f-rough/#f-ink SVG 滤镜 + 双皮肤外壳
│   ├── components/                                  # skin-switch, user-menu, feedback, fav-button
│   ├── pages/                                       # home, open, detail, create, login, register, me, about, not-found
│   └── skins/
│       ├── paper/                                   # _header, _footer, _tabbar, _card, _code-input, _home, _open, _detail, _create, _login, _register, _me, _about, _not-found
│       └── amber/                                   # 同上 + _datetime_picker（十年星轨时钟）
├── public/
│   ├── css/laravel.css                              # 仅 [x-cloak] 与 .list-more（使用 var(--space-8)）
│   ├── js/
│   │   ├── alpine.min.js                            # 同步自 node_modules/alpinejs
│   │   ├── ht-core.js                               # 格式化、专属色、SVG/头像生成、API 客户端（401单飞刷新）、Alpine Stores、星空画布
│   │   ├── ht-plaza.js                              # 8 格输码、分段滑块、乐观收藏按钮、首页广场、开启页
│   │   ├── ht-create.js                             # 创建页草稿/AI/校验/提交锁、时笺标尺与日历、长按火漆、折纸仪式、琥珀星轨时钟
│   │   └── ht-capsule-account.js                    # 详情页倒计时自动开启与退避轮询、登录/注册、我的（分页重读去重/资料/改密）
│   └── static/{avatars,icons}/
└── tests/
    ├── Unit/{CrossDbTest,JwtCodecTest}.php
    └── Feature/ApiV2RegressionTest.php
```

数据流清晰地分成两条主线，底层共享同一套 Service 与 Eloquent 模型：

```text
JSON API：
  routes/api.php → HelloTimeApiController → app/Services/* → Eloquent Models → Mapper → JSON Envelope

SSR 页面：
  routes/web.php → Web\{Page,Auth}Controller → app/Services/* → Blade View（直出 window.__HT_INIT__）
                 → Alpine.js 接管皮肤切换、本地草稿、星轨时钟/标尺、异步刷新（fetch /api/v1/*）
```

## 3. 如何运行与验证

数据库表结构与演示数据由仓库级 `./scripts/db` 管理：

```bash
# PostgreSQL（默认）
./scripts/db reset --seed
./scripts/hello start laravel

# SQLite
DB_DRIVER=sqlite ./scripts/db reset --seed
DB_DRIVER=sqlite ./scripts/hello start laravel
```

目录内常用脚本：

```bash
cd fullstacks/laravel
./build   # 安装 Composer/npm 依赖，运行 scripts-sync-assets.sh 同步字体、样式、头像与 Alpine
./test    # 运行 19 个 PHPUnit 用例（含跨库回归与关闭 SQLite 外键删收藏验证）
./run     # 同步静态资源后监听 127.0.0.1:7182
```

黑盒验收（2.0 目标：双库契约 **117/117**、双库 UI 冒烟 **88/88**、设计令牌通过）：

```bash
# 建议使用独立库避免重置默认库
DB_URL=postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_laravel ./verification/scripts/verify-contract.sh laravel
DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-contract-laravel.db ./verification/scripts/verify-contract.sh laravel
./verification/scripts/verify-ui-smoke.sh laravel
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh laravel
./verification/scripts/verify-design-tokens.sh laravel
```

## 4. 服务端架构与 2.0 契约要点

### 4.1 路由与控制器边界

- **`routes/api.php`**：暴露全部 2.0 端点，相比 1.x 新增 `GET /api/v1/plaza/stats` 与 `GET /api/v1/me/stats`。
- **`HelloTimeApiController`**：
  - 所有端点统一经 `api(callable $fn, int $status = 200, bool $empty = false)` 输出标准 envelope 或 204 无响应体。
  - `register`、`login`、`refresh` 在返回 JSON token 对的同时调用 `attachAuthCookies()` 写入 `ht_access`（60 分钟）与 `ht_refresh`（7 天）httpOnly cookie（`SameSite=Lax`、`path=/`，并在 `bootstrap/app.php` 中加入 `encryptCookies` 白名单以便与 Bearer JWT 共用解析逻辑）。
  - `logout` 与 `changePassword` 成功返回 204 时同时调用 `forgetAuthCookies()` 过期两枚 cookie。
- **`PageController` 与 `AuthController`**：
  - 受保护路由（`/create`、`/me/*`）在服务端第一帧即校验 `$this->auth->currentUser($request)`，未登录直接返回 `302 /login?redirect=...`，不存在“先闪出受保护页再客户端跳转”的问题。
  - 已登录访问 `/login` 或 `/register` 直接 302 回首页。
  - `/capsules/{code}` 查无此码时返回 HTTP 404 状态码并渲染带 `status: 'missing'` 的详情模板（呈现 `detail-not-found`），与未知路由的 404（`not-found`）语义分离。
  - `AppServiceProvider` 通过 `View::composer` 统一向布局注入 `$currentUserDto`、`$health` 与 `$avatarCatalog`。

### 4.2 2.0 业务规则清单落地

1. **`GET /api/v1/plaza/stats?q=`**（`PlazaService::plazaStats`）：
   - 与 `plazaList()` 复用同一套 `basePlazaQuery()`（`in_plaza = true`、`has('owner')`、转义后的 `LIKE ... ESCAPE '\'` 匹配标题或作者昵称）。
   - `counts`（`all` / `opened` / `unopened`）在空集合下严格落成 `0`。
   - `farthestOpenAt` 与 `nextOpenAt` 不受 `q` 影响，且采用 `ORDER BY open_at DESC/ASC LIMIT 1` 取列，避免 SQLite 聚合函数丢失类型或格式。
2. **`GET /api/v1/me/stats`**（`CapsuleService::myStats`）：统计当前用户的 `created`、`opened`、`unopened`、`inPlaza`、`favoritesReceived`、`favoritesGiven`，涵盖 `inPlaza = false` 的胶囊。
3. **2.0 收藏口径与并发锁**（`FavoriteService`）：
   - 不再限制自己、未公开或未开启胶囊；只校验路径/请求体中的 UUID 格式（非法 → 422 `VALIDATION_ERROR`）与胶囊存在性（不存在 → 添加返回 404，取消保持幂等 204）。
   - PostgreSQL 事务中先单独对 `capsules` 行执行 `lockForUpdate()`（不 join `users`，避免误锁作者行），再写入/删除 `favorites` 并维护 `favorite_count`。
4. **删除胶囊连带删收藏**（`CapsuleService::deleteCapsule`）：
   - 在同一事务内先锁胶囊行、显式删除该胶囊的全部 `favorites` 记录，再删除 `capsule`，不依赖数据库外键级联（`ApiV2RegressionTest` 专门在 `PRAGMA foreign_keys = OFF` 下回归验证）。
5. **开启时间上限 = 10 个日历年**（`CrossDb::addCalendarYears`）：
   - 按 UTC 年份加 10，若原日期在目标年不存在（例如闰年 2 月 29 日），显式回退到当月最后一天（2 月 28 日），避免 PHP `DateTimeImmutable::modify('+10 years')` 自动进位到 3 月 1 日。
6. **路径参数 UUID 校验与显式 `null` 输出**：
   - `GET /plaza/capsules/{id}`、`DELETE /me/capsules/{id}`、`DELETE /me/favorites/{capsuleId}` 与 `POST /me/favorites` 统一先校验标准 UUID 格式，不合法返回 422。
   - `Mapper` 对 `content`、`contentPreview`、`favoritedAt`、`farthestOpenAt`、`nextOpenAt` 等可空字段始终保留键并输出 `null`，绝不省略。
7. **头像升级至 v2**：`AvatarCatalog` 读取 `spec/avatars/v2/catalog.json` 并提取内联 SVG `<path>` 供前端双皮肤印章/头像组件复用。

## 5. 数据层：Eloquent ORM + `CrossDb`

由于 `spec/db/schema.sql` 规定 SQLite 存 32 位无横线 hex ID + ISO-8601 TEXT + `0/1` 整数，PostgreSQL 存原生 `uuid` + `timestamptz` + `boolean`，本实现把差异严格隔离在三处：

1. **模型主键与关系保持原始存储格式**（`HasCrossDbKey`）：不在 Eloquent 层把 `id` Cast 成带横线 UUID，确保 SQLite 上 `belongsTo` / `hasMany` 外键连接永远命中。查询入口使用 `CrossDb::idCandidates($uuid)`（SQLite 同时匹配 32-hex 与带横线 UUID，兼容种子数据与应用新建数据），输出出口由 `Mapper` 统一转为标准带横线 UUID。
2. **自定义布尔 Cast**（`App\Casts\CrossDbBoolean`）：避免 PDO pgsql 返回 `'f'` 被 PHP `(bool) 'f'` 误判为 `true`。
3. **跨库时间戳与 SQLite 并发配置**：
   - `CrossDb::dbTimestamp()` 在 SQLite 下统一输出 6 位微秒 ISO UTC（`Y-m-d\TH:i:s.u+00:00`），与种子和新建记录字符串排序完全一致。
   - `config/database.php` 为 SQLite 开启 `'busy_timeout' => 5000` 和 `'transaction_mode' => 'IMMEDIATE'`，避免并发写入从读锁升级写锁触发 `SQLITE_BUSY`。
   - `AppServiceProvider` 为 SQLite PDO 注册基于 `mb_strtolower()` 的 Unicode `LOWER` 函数，保证中文及大小写混合搜索一致。
   - `run` 脚本精确剥离 `sqlite:///` 前缀并将相对路径按仓库根目录解析，避免多去/少去斜杠导致路径错位。

## 6. 客户端架构：Blade SSR + Alpine.js 3 双皮肤

### 6.1 「逻辑一份，视图按皮肤分」的 Blade 实现方式

与 SPA 框架（React / Vue）类似，Laravel 版也严格拆分「共享状态与业务交互」和「按皮肤呈现的视图」：

- **外层页面壳（`resources/views/pages/*.blade.php`）** 挂载一个共享 Alpine 组件（如 `x-data="plazaHome()"`、`x-data="createPage()"`、`x-data="mePage()"`），读取服务端直出的 `window.__HT_INIT__` 作为初始状态。
- **内层双皮肤视图** 用 `<template x-if="$store.ui.skin === 'paper'">` 和 `<template x-if="$store.ui.skin === 'amber'">` 条件渲染。
  - **优点 1**：DOM 中永远只存在当前皮肤的一套节点，完全满足 `spec/ui/testids.md §1.4` 对非列表 `data-testid` 唯一性的要求。
  - **优点 2**：切换皮肤时外层 `x-data` 不销毁，表单输入、搜索防抖计时器、半截胶囊码、创建草稿、封存提交锁与回执全部保留（满足契约 X5）。
  - **优点 3**：固定数量的 SVG 刻度（星轨时钟表盘 60 刻度 + 60 表圈刻度 + 11 年份节点、首页主视觉 5 颗星芒、收藏 7 颗心形粒子）直接在 Blade 中用 `@for` / `@foreach` 输出，规避浏览器 HTML 解析器在 `<svg>` 内破坏 `<template x-for>` 的问题。

### 6.2 四个 Alpine 脚本模块的职责

| 文件 | 注册内容 | 职责 |
|---|---|---|
| `public/js/ht-core.js` | `HT` 工具集、`$store.ui`、`$store.auth`、`$store.clock`、`$store.feedback`、`amberBackdrop`、`userMenu`、`amberNavInk` | 格式化（按 Unicode 码点计数）、FNV-1a+OKLCH 专属色、同源 `fetch` 与 401 单飞刷新重放、View Transition 换肤（`data-skin-dir` + `is-skinning`）/ 圆形晕开明暗切换（`is-theming`）、星空粒子画布、Toast 与确认框 |
| `public/js/ht-plaza.js` | `makeCodeOpener`、`paperCodeInput`、`amberCodeInput`、`segControl`、`favBtn`、`plazaHome`、`openPage` | 8 格输码（支持整码粘贴/填充替换不拼接）、分段滑块定位、乐观收藏与失败回滚、广场防抖搜索（按码点截断 50 字）、`/` 快捷键聚焦、到点整页刷新、错误清空旧卡片与重试 |
| `public/js/ht-create.js` | `createPage`、`shakeOn`、`paperRuler`、`paperHoldSeal`、`paperCeremony`、`amberDateTimePicker`、`amberSealed` | 按账号隔离 `sessionStorage` 草稿、AI 推荐与逐字代笔（手动修改立即中止写入、失败保留原文）、10 日历年边界校验、时笺对数时间标尺 + 日历 + 定时器驱动长按火漆（1150ms，不依赖 rAF）、折纸信封仪式、琥珀「星轨时钟」（十年星轨、旅程线日历、非取模累加角度昼夜表盘、展开滚动与 `transitionend` 二次补滚） |
| `public/js/ht-capsule-account.js` | `capsuleDetailPage`、`loginPage`、`registerPage`、`mePage`、`meTabsIndicator` | 详情页倒计时归零自动开启 + 退避轮询 `awaitOpened`（1s..5s，`AbortController` 换肤/离页即停）、登录与注册跨皮肤保值、Unicode 码点昵称校验（区分 `invalid` 与 409 `taken`）、「我的」`list-next` 边界页重读与 ID 去重、删除确认、资料无改动提示与改密拦截 |

### 6.3 样式系统（零 Tailwind）

`layouts/app.blade.php` 按规范严格顺序加载同步到 `public/styles/` 的原样文件：

1. 自托管 `@fontsource` 字体（Noto Serif SC、Cormorant Garamond、IBM Plex Mono）；
2. `base.css` → `paper/{tokens,components,pages}.css` → `amber/{tokens,components,pages}.css` → `shell.css`；
3. 本实现唯一胶水样式 `public/css/laravel.css`（仅 `[x-cloak] { display: none !important; }` 与 `.list-more { margin-top: var(--space-8); text-align: center; }`，零硬编码色值）。

## 7. 与其他全栈实现的并排对照

| 关注点 | Next / Nuxt | Spring MVC | Rails | Laravel（本实现） |
|---|---|---|---|---|
| 路由定义 | 文件系统路由 | `@Controller` / `@RestController` | `config/routes.rb` | `routes/web.php` + `routes/api.php` |
| 视图与双皮肤 | React / Vue 双皮肤组件 | Thymeleaf + 客户端交互脚本 | ERB + Stimulus | Blade `<template x-if>` 双皮肤 + Alpine.js 3 |
| 服务端直出数据 | Server Component / `useAsyncData` | Model 属性 | Instance vars / JSON script | `PageController` → `window.__HT_INIT__` |
| 数据访问与跨库 | Drizzle ORM | Spring Data JPA / Hibernate | ActiveRecord + `CrossDb` | Eloquent ORM + `CrossDbBoolean` + `CrossDb` |
| 会话鉴权 | Bearer（localStorage） | CookieTokenFilter 桥接 | Rack middleware 桥接 | `AuthService` 同时解析 Bearer 与 httpOnly cookie |
| 样式方案 | `spec/styles` 2.0（零 Tailwind） | `spec/styles` 2.0（零 Tailwind） | `spec/styles` 2.0（零 Tailwind） | `spec/styles` 2.0（零 Tailwind） |

## 8. 常见改动指南

- **新增 API**：在 `routes/api.php` 注册路由 → 在 `HelloTimeApiController` 添方法 → 业务逻辑写入 `app/Services/*` → 输出结构在 `app/Support/Mapper.php` 统一收敛（可空字段显式返回 `null`）。
- **新增页面**：在 `routes/web.php` 注册路由 → `PageController` 准备首屏数据并决定是否做服务端登录守卫 → 新建 `pages/<name>.blade.php` 及 `skins/{paper,amber}/_<name>.blade.php`。
- **新增交互状态**：跨皮肤保留的状态放到页面外层的 Alpine `x-data` 或 `ht-core.js` 的 `Alpine.store`，单皮肤动效放到对应皮肤局部组件的 `x-data`（并在 `destroy()` 中清理定时器与 `document` 事件监听）。
- **新增跨库字段**：优先通过自定义 Eloquent Cast（参考 `CrossDbBoolean`）与 `CrossDb` 归一，不要把驱动分支散落到控制器或模板里。
- **修改样式或静态资源**：所有设计令牌与皮肤样式均以仓库根 `spec/styles/` 为准，修改后运行 `./build`（或 `bash ./scripts-sync-assets.sh`）同步，并用 `./verification/scripts/verify-design-tokens.sh laravel` 核验。
