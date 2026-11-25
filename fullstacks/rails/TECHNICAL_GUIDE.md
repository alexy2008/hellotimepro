# HelloTime Pro Rails 2.0 全栈技术手册与代码导读

本文面向已经了解 HTML / CSS / JavaScript 与关系型数据库基础，但还不熟悉 Ruby on Rails 8、Active Record 与 Hotwire（Turbo + Stimulus）这套现代全栈工作方式的读者。读完后，你应该能回答四件事：

- 浏览器访问 `/capsules/ABCD1234` 或调用 `/api/v1/plaza/capsules` 时，请求按什么顺序经过 Rails。
- ERB 服务端渲染、Turbo Drive / Frame / Stream 与 Stimulus 各自承担什么职责，如何不靠前端打包器实现双皮肤与丰富交互。
- Active Record + `CrossDb` 如何在同一个代码库里无缝支持 PostgreSQL 与 SQLite 双数据库。
- 想新增一个字段、接口、交互或样式时，应该改哪些文件。

---

## 1. 技术选型与设计特色

HelloTime Pro 的 Rails 2.0 全栈运行在 **7181** 端口，用**同一个进程**承载两套入口：

| 入口 | 消费者 | 鉴权方式 | 输出格式 |
|---|---|---|---|
| `/api/v1/*` | 黑盒契约测试、浏览器 `fetch` | `Authorization: Bearer`（浏览器同源自动由 Cookie 桥接） | 统一 JSON Envelope |
| SSR 页面 + `/ui/*` | 浏览器导航、Turbo Drive / Frame / Stream | `HttpOnly` Cookie + Rails CSRF 校验 | ERB HTML / Turbo Stream |

与 SPA（React / Vue / Angular / Svelte / Solid）或 JS SSR（Next / Nuxt）相比，本实现展示的是地道的 **Rails + Hotwire** 全栈范式：

- **零前端构建链路（Importmap + Propshaft）**：浏览器直接通过原生 ES Modules + `config/importmap.rb` 加载 `app/javascript/` 下的 Stimulus 控制器；`Propshaft` 直接将仓库根目录的 `spec/styles/` 与 `@fontsource` 字体同源提供给浏览器，**不使用 Tailwind、Webpack 或 Vite**。
- **HTML Over The Wire（Hotwire）**：页面主体、广场网格、个人列表、封存回执和表单错误提示都由 Rails 在服务端用 ERB 渲染成标准 HTML 或 Turbo Stream 片段送达浏览器；客户端 JavaScript（Stimulus）只负责局部增强（防抖搜索、8 格输码、倒计时、长按封缄、时笺标尺、琥珀星轨时钟与草稿记忆）。
- **两套皮肤，一份数据流（2.0）**：支持「时笺（`paper`）」与「琥珀（`amber`）」× 明暗两色，全部样式原样引入 `spec/styles/`。服务端一次输出双皮肤语义结构（`data-skin-only="paper|amber"`），切换皮肤只改 `<html data-skin>` 属性并触发 View Transition，零网络往返且保留全部表单与筛选状态。
- **单库契约，双驱动兼容**：Active Record 默认连接 PostgreSQL，也可通过 `DB_DRIVER=sqlite` 切到 SQLite；所有业务规则收敛在 `app/services/`，网页与 API 共用同一批 Service。

---

## 2. 整体目录地图

```text
fullstacks/rails/
├── README.md                              # 启动、验证与迁移笔记
├── TECHNICAL_GUIDE.md                     # 本手册
├── run / build / test                     # 启动（:7181）/ 构建检查 / 独立 SQLite 单测
├── Gemfile / package.json                 # Ruby gem 与 @fontsource 自托管字体
├── config/
│   ├── routes.rb                          # /api/v1/*、SSR 页面、/ui/* 片段、/static/*
│   ├── database.yml                       # PostgreSQL / SQLite 双驱动解析（相对路径基于仓库根）
│   ├── importmap.rb                       # 浏览器 ESM 映射（Turbo / Stimulus / controllers / lib）
│   └── initializers/
│       ├── assets.rb                      # 将 spec/styles 与 @fontsource 加入 Propshaft 资产路径
│       ├── boot_time.rb                   # 进程启动时间（/api/v1/health uptimeSeconds）
│       ├── sqlite_search.rb               # 注册 SQLite Unicode 小写函数 hellotime_lower
│       └── tolerant_json_params.rb        # 坏 JSON 请求体降级为 {}，交业务校验返 422
├── lib/middleware/
│   └── cookie_token_bridge.rb             # Rack 中间件：将 ht_access Cookie 桥接为 Bearer 头
├── app/
│   ├── lib/
│   │   ├── api_error.rb                   # 业务异常（400/401/403/404/409/422/429）
│   │   └── cross_db.rb                    # SQLite 自定义 UUID/时间类型、StoredUuid 与等宽时间比较
│   ├── models/                            # ApplicationRecord · User · Capsule · Favorite · RefreshToken
│   ├── services/                          # 应用层与领域逻辑（网页与 API 共用）
│   │   ├── app_config.rb                  # 环境变量配置中心（DB / JWT / LLM）
│   │   ├── validation.rb                  # 与 openapi.yaml 对齐的字段校验（含布尔、UUID、Unicode 长度）
│   │   ├── mapper_service.rb              # Model → OpenAPI 2.0 响应 Hash（保留 null 字段）
│   │   ├── auth_service.rb                # 注册、登录、Refresh 轮换与家族吊销、改密
│   │   ├── security_service.rb            # bcrypt + HS256 JWT + SHA-256 refresh hash
│   │   ├── capsule_service.rb             # 创建（10 日历年校验）、按码查询、事务显式连带删除
│   │   ├── plaza_service.rb               # 广场列表、广场统计、个人统计、我的胶囊与收藏
│   │   ├── favorite_service.rb            # 2.0 收藏/取消收藏（不限胶囊状态，PG 先锁胶囊行）
│   │   ├── user_service.rb                # 资料更新与昵称查重
│   │   ├── avatar_service.rb              # 读取 spec/avatars/v2/catalog.json 与内联 SVG
│   │   ├── health_metadata.rb             # /api/v1/health 技术栈元数据（version 2.0.0）
│   │   ├── llm_client.rb                  # LLM 结构化输出客户端（含标准日志、UA 与 session 头）
│   │   ├── capsule_suggestion_service.rb  # AI 代笔（失败本地兜底）
│   │   └── capsule_recommendation_service.rb # AI 推荐主题（失败静默返回空列表）
│   ├── controllers/
│   │   ├── concerns/
│   │   │   ├── auth_resolution.rb         # Bearer JWT 解析（optional_user / require_user!）
│   │   │   └── cookie_auth.rb             # 网页 HttpOnly Cookie 会话与按需 refresh
│   │   ├── api/v1/                        # BaseController 及 7 个 JSON API 控制器
│   │   ├── application_controller.rb      # SSR 页面控制器基类
│   │   ├── public_controller.rb           # 首页 /、开启 /open、详情 /capsules/:code、关于 /about、404
│   │   ├── auth_view_controller.rb        # 登录 /login、注册 /register、登出 /logout
│   │   ├── create_controller.rb           # 创建 /create（Turbo Stream 返回封存回执）
│   │   ├── me_controller.rb               # /me/created、/me/favorites、/me/profile 与片段/改密
│   │   └── static_assets_controller.rb    # 映射 /static/avatars/* 与 /static/icons/* 到 spec/
│   ├── views/
│   │   ├── layouts/application.html.erb   # 首帧皮肤/明暗内联脚本、页头、主视图、页脚、反馈容器
│   │   ├── shared/                        # 跨皮肤共用局部模板（页头、页脚、输码框、头像选择器、表单字段）
│   │   ├── public/ · auth_view/ · create/ · me/ # 各路由页面模板
│   │   └── skins/
│   │       ├── paper/                     # 「时笺」专属结构：卡片、详情、创建、回执、标尺日历、火漆、邮戳
│   │       └── amber/                     # 「琥珀」专属结构：卡片、详情、创建、回执、星轨时钟、星空、胶囊插画
│   ├── assets/stylesheets/application.css # 按序引入 spec/styles + 极少量语义令牌胶水
│   └── javascript/
│       ├── application.js                 # 导入 Turbo 与 Stimulus 控制器注册
│       ├── lib/                           # ui.js · skin_view.js · draft.js · date.js
│       └── controllers/                   # 16 个按组件拆分的 Stimulus 控制器
└── script/
    ├── smoke.rb                           # ./test 入口：关闭 SQLite 外键跑核心规则单测
    ├── plaza_navigation.cjs               # Playwright 广场卡片导航回归
    └── skin_alignment.cjs                 # Playwright 正常动效双皮肤仪式回归
```

---

## 3. 如何运行与验证

以下命令均在仓库根目录执行（表结构与演示数据由 `./scripts/db` 管理，本应用启动时不会建表或导入数据）：

```bash
# 1. 构建检查（安装 gem/字体 + Zeitwerk 自动加载检查）与独立单元测试
(cd fullstacks/rails && ./build && ./test)

# 2. PostgreSQL（默认）
./scripts/db init
./scripts/hello start rails        # http://127.0.0.1:7181

# 3. SQLite（与 scripts/db 使用同一 DB_URL）
DB_DRIVER=sqlite DB_URL="sqlite:///${PWD}/data/sqlite/hellotime-rails.db" ./scripts/db init
DB_DRIVER=sqlite DB_URL="sqlite:///${PWD}/data/sqlite/hellotime-rails.db" ./scripts/hello start rails
```

黑盒验证（契约测试会重置 `DB_URL` 指向的库，请使用独立验证库）：

```bash
# 设计令牌静态一致性
./verification/scripts/verify-design-tokens.sh rails

# API 契约（117/117，PostgreSQL 与 SQLite 双库）
DB_URL="postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_rails" \
  ./verification/scripts/verify-contract.sh rails
DB_DRIVER=sqlite DB_URL="sqlite:////tmp/hellotime-contract-rails.db" \
  ./verification/scripts/verify-contract.sh rails

# UI 冒烟（44 条 × 两套皮肤 = 88/88，PostgreSQL 与 SQLite 双库）
./verification/scripts/verify-ui-smoke.sh rails
```

---

## 4. 一次请求如何走过 Rails

### 4.1 API 请求链路（如 `GET /api/v1/plaza/stats?q=foo`）

1. **Rack 中间件**：请求经过 [`CookieTokenBridge`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/lib/middleware/cookie_token_bridge.rb)。若路径以 `/api/v1/` 开头且没有 `Authorization` 头，但携带 `ht_access` Cookie，则自动补上 `Authorization: Bearer <token>`。这样浏览器 `fetch` 与外部 Bearer 客户端完全共用一套控制器，且不影响契约的「无鉴权返回 401」测试。
2. **路由分发**：[`config/routes.rb`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/config/routes.rb) 将请求路由到 `Api::V1::PlazaController#stats`。
3. **统一外壳与异常拦截**：[`Api::V1::BaseController`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/controllers/api/v1/base_controller.rb) 继承轻量的 `ActionController::API`，关闭 `wrap_parameters`，通过 `rescue_from ApiError` 将领域异常统一转成 `{ success: false, data: nil, message, errorCode, details? }`，通过 `render_ok(data)` 输出 `{ success: true, data, message: nil, errorCode: nil }`，不省略 `null` 字段。
4. **服务层与模型层**：控制器只做参数提取，全部业务计算委托给 [`PlazaService.plaza_stats`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/services/plaza_service.rb#L25-L34) 与 `Capsule` 模型作用域。

### 4.2 网页 SSR 与局部更新链路（如直接访问 `/capsules/ABCD1234`）

1. **会话恢复**：[`ApplicationController`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/controllers/application_controller.rb) 混入 [`CookieAuth`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/controllers/concerns/cookie_auth.rb)。`current_user` 优先验证 `ht_access` JWT，**仅在缺失或明确过期（`access_token_expired`）时**才用 `ht_refresh` 轮换一次并回写新 Cookie，避免并发导航反复刷新触发 refresh token 重用吊销。
2. **页面渲染**：[`PublicController#capsule`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/controllers/public_controller.rb#L27-L34) 调用 `CapsuleService.get_by_code`：
   - 未开启时服务层保证 `content: nil`，ERB 渲染未开启视图与倒计时容器。
   - 胶囊不存在或格式非法（404 / 422）时渲染 `capsule_missing`（带 `detail-not-found`）；数据库异常时渲染可重试的 `capsule_error`。
3. **倒数归零自动启封**：浏览器里的 [`countdown_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/countdown_controller.js) 每 250ms 刷新倒计时与等待进度；归零后播放当前皮肤的开启动效（时笺拆蜡掀封舌 / 琥珀胶囊抖动迸光，`prefers-reduced-motion: reduce` 时跳过动效），随后带 `AbortSignal` 退避轮询 `GET /ui/capsules/:code`（1s → 2s → 4s → ≤5s），**直到服务端 HTML 片段明确标记 `data-state="opened"`** 才替换 `<turbo-frame id="capsule-body">`，并弹出提示。换肤或离开页面时立即 `abort` 旧轮询。

---

## 5. 双皮肤 SSR 架构与设计令牌

### 5.1 首帧防闪烁与皮肤转场

[`application.html.erb`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/views/layouts/application.html.erb) 在样式加载前执行同步内联脚本：

- 从 `localStorage` 读取 `hellotime.skin`（缺省 `amber`）与 `hellotime.theme`（缺省跟随 `prefers-color-scheme: light`，否则 `dark`），立刻写入 `<html data-skin data-theme>` 并同步 `<meta name="theme-color">`。
- 样式入口 [`application.css`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/assets/stylesheets/application.css) 按固定顺序 `@import` 根目录 `spec/styles/`：`base.css` → `paper/{tokens,components,pages}.css` → `amber/{tokens,components,pages}.css` → `shell.css`。所有自定义胶水规则都限定在 `:root[data-skin=...]` 下且只用语义令牌，不写颜色字面量。
- 切换皮肤时，[`shell_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/shell_controller.js) 先写 `data-skin-dir="prev|next"` 与 `.is-skinning` 启动「柔光拂过」View Transition（明暗切换则以点击坐标为中心播放圆形 `clipPath` 扩散动画）；减少动效时跳过过渡直接生效，确保满足 X1 与 X5。

### 5.2 如何保证两套皮肤共用状态且 `data-testid` 全局唯一

在纯 SSR 页面中，两套皮肤结构差异较大的区域（卡片、详情、创建页、回执、关于页、页脚）会在 ERB 中成对输出 `data-skin-only="paper"` 与 `data-skin-only="amber"`，由 CSS 隐藏非当前皮肤。但 [`spec/ui/testids.md`](file:///Users/alex/AiWork/HelloTimeProByClaude/spec/ui/testids.md) 要求**非列表类测试钩子在 DOM 中同一时刻必须唯一（隐藏副本也不行）**。

本实现用 [`syncSkinHooks(root)`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/lib/skin_view.js#L2-L11) 解决这一矛盾：

1. 属于单一皮肤子树的元素在 ERB 中写 `data-view-testid="..."` 而不是静态 `data-testid`。
2. 页面加载、切换皮肤或局部片段替换后，`syncSkinHooks` 扫描 `[data-view-testid]`：只给「可见且属于当前激活皮肤」的节点写入 `data-testid`，其余节点删除 `data-testid`。
3. 表单状态跨皮肤保留：
   - **输码、搜索、登录、注册、资料与改密**：两套皮肤共用同一组 `<input>` DOM 节点，换肤时浏览器不会重建输入框，值、焦点和错误态天然保留。
   - **创建页**：两套皮肤的字段包在同一个 `<form>` 下的两个 `<fieldset class="create-view">` 中，非当前皮肤的 `<fieldset>` 置为 `disabled`（不参与表单提交），[`create_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/create_controller.js) 在每次编辑时同步双边字段与内存草稿，并在切换皮肤时切换哪一个 `<fieldset>` 启用。

---

## 6. 双数据库适配：PostgreSQL 与 SQLite

### 6.1 连接解析（[`config/database.yml`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/config/database.yml)）

- 通过 `DB_DRIVER=sqlite` 或 `DB_URL=sqlite:///...` 判定 SQLite；否则归一化 `postgresql+psycopg://` 等驱动前缀连接 PostgreSQL。
- SQLite 的 `DB_URL` 去掉 `sqlite:///` 前缀后，统一以 `REPO_ROOT` 调用 `File.expand_path` 解析：绝对路径 `sqlite:////tmp/a.db` 得 `/tmp/a.db`，相对路径 `sqlite:///data/sqlite/a.db` 得 `<仓库根>/data/sqlite/a.db`，与 `./scripts/db` 完全一致。
- SQLite 配置 `pool: 1`、`timeout: 5000`，配合 Rails 8.1 默认的 `BEGIN IMMEDIATE` 写事务，避免并发读写升级锁引发 `SQLITE_BUSY`。

### 6.2 `CrossDb` 跨库类型与查询统一（[`app/lib/cross_db.rb`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/lib/cross_db.rb)）

PostgreSQL 原生支持 `uuid` 与 `timestamptz`；SQLite 下这两列存为 `TEXT`，因此只在 SQLite 驱动下通过 `ApplicationRecord.cross_db_uuid` / `cross_db_timestamp` 挂载自定义 `ActiveRecord::Type`：

- **混合 UUID 兼容（`StoredUuid`）**：种子数据或其他栈写入的 SQLite 主键可能是 32 位无连字符 hex，也可能是 36 位带连字符 UUID。`SqliteUuidType#deserialize` 返回继承自 `String` 的 `StoredUuid`：在 Ruby 内存和 API JSON 中始终表现为标准带连字符 UUID，同时在 `@storage` 里保留数据库原始值；`serialize` 写外键（收藏、删除）时回写 `@storage`，而查询主键统一走 `ApplicationRecord.by_uuid(id)` 同时匹配两种格式。
- **同秒小数位精确比较（`CrossDb.time_column` / `time_bound`）**：SQLite 中种子时间戳可能不带小数秒（`...T08:00:00+00:00`），应用写入可能带小数秒（`...T08:00:00.0001+00:00`），直接按 ASCII 字典序比较会因 `+`（43）< `.`（46）导致同秒排序错误。`time_column` 在 SQL 表达式中把所有时间规范为等宽 9 位纳秒字符串（`YYYY-MM-DDTHH:MM:SSnnnnnnnnn`）再与 `time_bound(now)` 比较，保证同一秒内的整秒与小数秒顺序和开封判定完全精确。
- **字面 Unicode 搜索**：[`sqlite_search.rb`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/config/initializers/sqlite_search.rb) 为 SQLite 连接注册了 `hellotime_lower` 函数（利用 Ruby 原生 Unicode `downcase` 补齐 SQLite `LOWER` 只管 ASCII 的短板）。[`PlazaService.plaza_scope`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/services/plaza_service.rb#L69-L83) 用 `sanitize_sql_like` 转义 `\`、`%`、`_` 并声明 `ESCAPE '\'`，PostgreSQL 与 SQLite 共用同一字面匹配口径。

### 6.3 事务一致性、行锁顺序与日历年上限

- **统一加锁顺序防死锁**：[`FavoriteService.add_favorite`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/services/favorite_service.rb#L4-L23)、`remove_favorite` 与 [`CapsuleService.delete_own`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/services/capsule_service.rb#L39-L48) 在事务内都先调用 `Capsule.row_lock(Capsule.by_uuid(id)).first`（PostgreSQL 下执行单表 `SELECT ... FROM capsules ... FOR UPDATE`，绝不 `JOIN users` 误锁用户行），随后再读写 `favorites` 表并维护 `capsules.favorite_count`。
- **显式连带删除**：`CapsuleService.delete_own` 先 `Favorite.where(capsule_id: capsule.id).delete_all` 再 `capsule.destroy!`，不依赖外键级联（`./test` 显式执行 `PRAGMA foreign_keys = OFF` 回归验证）。
- **10 个日历年上限**：[`CapsuleService.validate_open_at!`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/services/capsule_service.rb#L50-L53) 使用 ActiveSupport `now.advance(years: 10)`，对闰日 `2028-02-29` 自动落到 `2038-02-28` 而非进位为 3 月 1 日；前端 [`date.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/lib/date.js#L28-L34) 的 `addYearsUtc` 使用完全一致的 UTC 日历年算法，并在两头预留余量避免客户端时钟偏差撞线。

---

## 7. 客户端交互：Turbo 与 Stimulus 分工

| 控制器 | 负责的交互与关键边界处理 |
|---|---|
| [`shell_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/shell_controller.js) | 皮肤/明暗切换（View Transition + `data-skin-dir` + `theme-color`）、导航指示条、`syncSkinHooks`、账号边界同步（登出/换号清空草稿）、匿名点击「创建」先弹 `confirm-dialog` 再跳 `/login?redirect=/create` |
| [`plaza_search_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/plaza_search_controller.js) | 260ms 防抖搜索（按 Unicode 码点限 50 字）、`/` 快捷键聚焦、Esc 清空、`history.replaceState` 同步 URL；加载时按 X8 渲染骨架移除旧 `capsule-card`；监听 `clock:expired` 事件在胶囊到点时自动刷新网格与顶部年鉴 |
| [`code_input_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/code_input_controller.js) | 首页与开启页共用的 8 格输码；过滤非 `[A-Z0-9]` 并转大写；通过 `InputEvent.data` 识别整串 8 位码粘贴/填充并从头覆盖；换肤保留已填码与错误态，改码或离页用 `AbortController` 作废旧查询 |
| [`countdown_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/countdown_controller.js) | 详情页 250ms 节拍倒计时与等待进度条/进度环；归零后播放双皮肤启封仪式，退避轮询 `/ui/capsules/:code` 直到服务端确认 `data-state="opened"` |
| [`create_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/create_controller.js) | 跨皮肤同步标题/正文/开启时间/公开开关与实时预览；按账号内存草稿（`lib/draft.js`）；AI 推荐与打字机代笔（用户手改任意字段立即 `abort` 终止代笔、失败保留原文）；防重复提交锁、Turbo Stream 渲染回执并按快照版本清理草稿 |
| [`seal_hold_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/seal_hold_controller.js) | 时笺 900ms 长按火漆封缄，同时支持鼠标指针捕获与键盘 `Space`/`Enter` 长按（满足 X2）；使用 `setTimeout` + `setInterval` 驱动，后台标签页不会像 `requestAnimationFrame` 那样卡死 |
| [`paper_calendar_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/paper_calendar_controller.js) | 时笺对数非线性时间标尺（拖动/点击/方向键/PageUp/PageDown）与精确到分钟的月历面板 |
| [`orbit_picker_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/orbit_picker_controller.js) | 琥珀「星轨时钟」：十年星轨滑块（换日保留时刻）、带旅程线的月历、机械表式昼夜表盘（指针角度累加 `unwrap` 不倒转、先拖时针松手切分针、分针跨 12 点自动进退一小时）、展开后 `transitionend` + 500ms 兜底补滚进视口 |
| [`favorite_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/favorite_controller.js) | 匿名收藏先弹 `confirm-dialog` 再带 `?redirect=` 跳登录；登录态乐观更新全页同 ID 按钮与精选/详情计数，失败自动回滚并提示 |
| [`personal_list_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/personal_list_controller.js) | 「我的」列表加载更多（`?visible=N`）、删除确认与取消收藏后按剩余条数重读服务端前缀、加载失败提供 `list-retry` 重试 |
| [`account_form_controller.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/account_form_controller.js) | 注册/资料页 Unicode 昵称即时校验（1 字给辅助提示、2–20 位标 `valid/invalid`、冲突由服务端标 `taken`）、密码强度灯与完整客户端校验；资料与改密服务端 422 走 Turbo Stream 局部更新错误区，互不冲掉同页另一表单 |

---

## 8. 常见改动指南

1. **给 API 接口新增一个返回字段**
   - 先确认 [`spec/api/openapi.yaml`](file:///Users/alex/AiWork/HelloTimeProByClaude/spec/api/openapi.yaml) 已定义字段与空值约定。
   - 在 [`MapperService`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/services/mapper_service.rb) 对应 DTO 方法中输出字段（空值显式写 `nil`）。
   - 如页面需展示，同步更新 `app/views/skins/paper/` 与 `app/views/skins/amber/` 下的模板。
2. **新增一个双皮肤专属页面元素与测试钩子**
   - 在两套皮肤的 ERB 中各自按原型写出 DOM 结构，并统一标 `data-view-testid="<kebab-case>"`。
   - 确认所在外层带有 `data-skin-only="paper|amber"`；若是局部异步更新的片段，替换 DOM 后调用 `syncSkinHooks(container)`。
3. **新增一个 Stimulus 控制器**
   - 在 `app/javascript/controllers/` 下按 `<name>_controller.js` 命名，[`controllers/index.js`](file:///Users/alex/AiWork/HelloTimeProByClaude/fullstacks/rails/app/javascript/controllers/index.js) 会通过 `eagerLoadControllersFrom` 自动注册。
   - 所有定时器、全局监听与网络请求务必在 `disconnect()` 中清理或 `abort()`，避免 Turbo Drive 切换页面时产生幽灵回调。
4. **修改数据库查询或时间/UUID 过滤条件**
   - 主键查询一律使用 `Model.by_uuid(id)`，时间比较/排序一律使用 `Capsule.open_at_column` / `CrossDb.time_column` 与 `CrossDb.time_bound`，并在 `./test`（SQLite 关闭外键）及 PostgreSQL 契约测试下各跑一遍确认。
