# HelloTime Pro · Ruby on Rails 全栈

Ruby + Ruby on Rails + Hotwire 实现的 HelloTime Pro 全栈，满足 `spec/` 定义的统一 API 契约，
同一进程同时提供 `/api/v1` JSON 接口与服务端渲染（SSR）UI，支持 PostgreSQL / SQLite 双驱动。
端口 **7181**（见根 `CLAUDE.md` 端口分配）。

这是全栈实现里的第二个「服务端渲染」代表，与 `fullstacks/spring-mvc`（Thymeleaf + HTMX）对照——
Rails 这版用 **Hotwire（Turbo + Stimulus）** 承载交互，展示 Rails 8 的招牌前端方案。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | Ruby 4.x（Homebrew） |
| 框架 | Ruby on Rails 8 |
| 交互增强 | Hotwire：Turbo Frame（广场搜索片段）+ Stimulus（AI/收藏/码输入/资料） |
| 数据访问 | Active Record（自定义 Type 处理跨库格式） |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | jwt（HS256）+ bcrypt；SSR 端 httpOnly cookie + cookie→Bearer 桥 |
| 资产 | importmap-rails（JS）+ Propshaft；Tailwind v4 CLI（构建期 Node）→ `public/css/app.css` |

## 目录结构（分层）

```
fullstacks/rails/
  app/
    controllers/                  ← presentation：api/v1/*（JSON）+ SSR 控制器 + ui（片段/动作）
    controllers/concerns/         ← AuthResolution（Bearer）/ CookieAuth（cookie 鉴权桥）
    services/                     ← application/domain：Auth/User/Capsule/Plaza/Favorite/Llm/...
    models/                       ← Active Record 实体（cross_db_uuid / cross_db_timestamp）
    lib/cross_db.rb               ← 跨库 UUID/时间戳格式 + 自定义 ActiveRecord::Type
    lib/api_error.rb              ← 业务异常 → 契约错误外壳
    javascript/controllers/       ← Stimulus 控制器
    views/                        ← ERB 模板（layout + public/auth_view/create/me）
  lib/middleware/cookie_token_bridge.rb  ← /api/v1 缺 Authorization 时用 ht_access cookie 注入 Bearer
  config/database.yml             ← 按 DB_DRIVER/DB_URL 解析单一外部数据库
  tailwind/{app.css, layout.css}  ← Tailwind 输入（复用 spec/styles 设计令牌）
  run / build / test              ← 端口 7181；test 跑跨库格式不变式
```

## 安装与运行

需要 Homebrew Ruby 4.x（系统 ruby 2.6 太旧；脚本会自动定位 `/opt/homebrew/opt/ruby`）与 `pg`/`bcrypt`/`jwt` gem。

```bash
# 通过仓库级 dev-manager（推荐，会注入 DB/LLM 配置）
./scripts/db reset --seed
./scripts/hello start rails
./scripts/hello logs rails

# 或直接在本目录
./build        # bundle install + Tailwind 构建
./run          # 启动（默认 postgres；DB_DRIVER=sqlite 切 SQLite）
./test         # 跨库格式不变式（rails runner，默认 SQLite）
```

## 切换数据库驱动

由环境变量控制，schema/数据生命周期完全在应用之外（`scripts/db`）：

```bash
DB_DRIVER=postgres ./run     # 默认；DB_URL 由 hello 从 data/.hello-state.json 注入
DB_DRIVER=sqlite   ./run     # DB_URL=sqlite:///<abs path>
```

`database.yml` 用 ERB 解析 `DB_URL`（`sqlite:///<abs>` 或 `postgresql[+driver]://user:pass@host:port/db`）。
应用 **不** 建表、不迁移、不 seed。

## 实现特色

- **同进程双接口 + cookie→Bearer 桥**：`/api/v1/*`（Bearer）与 SSR 页面（httpOnly cookie）共存；
  `lib/middleware/cookie_token_bridge.rb` 对缺 Authorization 头的 `/api/v1` 请求用 `ht_access` cookie
  注入 `Bearer`，让浏览器 fetch（AI/资料）复用同一套 Bearer 鉴权控制器。契约黑盒发真实 Bearer 时不介入。
- **跨库存储格式**（`lib/cross_db.rb`）：仅在 SQLite 下用自定义 `ActiveRecord::Type` 把 UUID 存成 32 位无横线
  hex、时间戳存 ISO-8601 TEXT（`T` 分隔、`+00:00`、零小数不输出，与 seed 一致——支撑字符串比较的
  `open_at <= now` / `ORDER BY created_at`）；Postgres 走原生 `uuid` / `timestamptz`。裸 SQL 绑定时间戳
  按方言取 ISO 串/`Time`，避免 AR 默认格式破坏字符串可比性。
- **Hotwire 分工**：广场搜索用 Turbo Frame（`/ui/plaza/grid` 渲染 `<turbo-frame id="plaza-grid">` 局部替换，
  `target="_top"` 让卡片链接整页导航）；AI 推荐/生成、8 位码输入、头像选择、用户菜单、资料保存用 Stimulus 控制器。
- **收藏切换用同步 XHR**（`favorite_controller.js`）：保证「点完立刻导航到 /me/favorites」前收藏已落库提交，
  消除 PostgreSQL 下 `FOR UPDATE` 行锁较慢导致的竞态（见 docs/dev-notes.md §4）；匿名点击纯客户端 confirm 跳登录。
- **并发一致性**：Postgres 路径 `Capsule.where(id:).lock`（SELECT ... FOR UPDATE）序列化收藏计数与 refresh token
  轮转；SQLite 单写事务。refresh 重用检测先提交家族吊销、事务外抛 401。
- **统一外壳**：API 基类 `rescue_from` 把业务异常转为契约约定的 `{ success, data, message, errorCode }`；
  坏 JSON body 由容错解析器降级为 `{}` → 字段校验 422。

## 验证

```bash
./verification/scripts/verify-contract.sh rails                 # PostgreSQL 契约 104/104
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh rails # SQLite 契约 104/104
./verification/scripts/verify-ui-smoke.sh rails                  # PostgreSQL UI 25/25
DB_DRIVER=sqlite ./verification/scripts/verify-ui-smoke.sh rails # SQLite UI 25/25
```

最新验收：2026-06-06，契约 PostgreSQL & SQLite 各 **104/104**，UI 冒烟 PostgreSQL & SQLite 各 **25/25**。

## 注意事项

- 系统 ruby 是 2.6（太旧）；run/build/test 显式把 `/opt/homebrew/opt/ruby/bin` 与 gem 可执行目录加进 PATH。
- 中间件是普通类，放 `lib/middleware/` 并在 `config/application.rb` 显式 `require`（config 阶段 autoload 未就绪，
  字符串中间件名 Rails 8 不再 constantize）。
- `rescue_from` 按「后注册先匹配」：先注册 `StandardError` 兜底、后注册 `ApiError` 优先命中，否则业务 422 会被吞成 500。
- `public/css/app.css` 是 Tailwind 构建产物，已提交作为无 npm 时的兜底。
