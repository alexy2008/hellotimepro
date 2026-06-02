# HelloTime Pro 开发规划

> 版本 0.2 · 2026-04-18 · 面向对象：新加入本项目的开发者 / 阅读者

> 阅读本文之前建议先读 [01-requirements.md](01-requirements.md) 和 [02-design.md](02-design.md)。

---

## 1. 总体策略

本项目用"**规范先行 → 参考实现 → 分批扩散**"的节奏推进：

```
 M0 设计基础     ──→  M1 参考栈（FastAPI + React）
                                   │
                                   ▼
                      M2 第一批扩散
                      ├─ 后端：Spring Boot · Gin
                      ├─ 前端：Vue · Angular
                      └─ 全栈：Next.js · Nuxt
                                   │
                                   ▼
                      M3 全面扩散
                      ├─ 后端：其余 8 个
                      ├─ 前端：Svelte · Solid
                      └─ 全栈：Rails · Laravel · Spring MVC
                                   │
                                   ▼
                      M4 打磨 + 文档 + 发布 v1.0
```

每个扩散阶段以**参考实现的行为**为事实基准，新实现须通过契约验证才算合格。

## 2. 参考栈

**后端：FastAPI · 前端：React**

> 选择原因：FastAPI 分层清晰（router / service / schema / model）、文档齐全、Python 社区受众最广，是后端最易读懂的参考模板；React 是目前使用最广的前端框架，以其为基准让更多读者能快速上手对比其他前端。两者语言不同，恰好能分开演示"后端结构"和"前端结构"两件事。

参考栈的产出是后续扩散的**模板**：

- API 形状、错误码、分页格式
- 数据库迁移文件的命名、字段顺序、索引集
- Tailwind preset 配置、token 消费方式
- 鉴权流程（refresh token rotate、改密吊销）的代码边界

## 3. 里程碑详情

### M0 · 设计与基础设施（1–2 周）

**状态**：已完成并验收（2026-05-02）。

**目标**：spec 完整、工具链可运行、视觉原型可看。

**交付物**

- [x] `spec/api/openapi.yaml`：完整路径 + schema + 错误模型
- [x] `spec/db/schema.sql`：PostgreSQL 方言，单一事实基准
- [x] `spec/styles/tokens.css` + `spec/tokens/tokens.json`：双向同步
- [x] `spec/avatars/*.svg` 10 个 + `catalog.json`
- [x] `spec/icons/` 技术栈 SVG 图标（覆盖所有 20 个实现涉及的技术）
- [x] `ui-prototype/` 静态 HTML（首页广场 / 登录 / 注册 / 创建胶囊 / 我的 / 关于）
- [x] `scripts/hello`（`start / stop / status / switch / doctor` 可用）
- [x] `docker-compose.yml`（Postgres 服务，端口 55432）
- [x] `docs/` 本套三份文档
- [x] `verification/contract/*.spec.ts` 用例列表（可不实现，先列齐）

**不做**：任何实际后端 / 前端代码

**通过条件**

- [x] `ui-prototype/` 所有页面可在浏览器打开，视觉确认无大问题
- [x] `docker compose up -d postgres` + `./scripts/hello doctor` 可运行
- [x] 设计原型已经被项目 owner 确认

---

### M1 · 参考栈（2–3 周）

**状态**：已完成并验收（2026-05-02）。

**目标**：FastAPI + React 跑通全部功能，成为后续实现的行为标准。

**交付物**

- [x] `backends/fastapi/`
  - [x] 完整 `/api/v1/*` 实现
  - [x] Alembic 迁移，schema 与 `spec/db/schema.sql` 100% 对齐
  - [x] PG + SQLite 双驱动通过
  - [x] 单元测试覆盖核心 service
  - [x] `./run` `./build` `./test`
  - [x] README（安装 / 运行 / 切换驱动 / 实现特色）
- [x] `frontends/react-ts/`
  - [x] 全部 12 条路由实现
  - [x] 所有必要组件（见 `02-design.md §9.4`）
  - [x] Zustand 管理 auth / capsule / plaza store
  - [x] 鉴权全流程（登录 / 登出 / 自动 refresh / 改密）
  - [x] 广场 sort / filter / 分页
  - [x] 收藏（匿名时跳提示）
  - [x] 主题切换持久化
  - [x] `./run` `./build` `./test`
  - [x] README
- [x] `verification/scripts/verify-contract.sh fastapi` 绿
- [x] `verification/scripts/verify-ui-smoke.sh react-ts` 绿

**通过条件**

- [x] 新开发者按 README 可在 30 分钟内把 FastAPI + React 跑起来
- [x] 契约验证全绿
- [x] UI 冒烟跑通完整主流程（注册 → 创建公开胶囊 → 登出 → 登录另一用户收藏 → 进"我收藏的"）
- [x] PG 和 SQLite 模式各至少跑通一次

**验收记录**

- 2026-05-02：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi` 通过，93/93。
- 2026-05-02：`./verification/scripts/verify-contract.sh fastapi` 通过，PostgreSQL 93/93。
- 2026-05-02：`./verification/scripts/verify-ui-smoke.sh react-ts` 通过，Playwright 4/4。

---

### M2 · 第一批扩散（3–4 周，可并行）

**目标**：6 个实现（2 后端 + 2 前端 + 2 全栈）同时推进，以 M1 为基准达到"契约绿"。

**状态**：✅ **已完成并验收（2026-05-11）**——6 个实现全部就位，所有后端 / 全栈在 PostgreSQL 和 SQLite 上契约 92/92 通过，5 套前端 UI 冒烟 4/4 通过（含全栈 next / nuxt）。

#### 后端

| 实现 | 要点 | 契约 PG | 契约 SQLite |
|---|---|---|---|
| `backends/spring-boot/` | Java 21 + Spring Data JPA + Flyway；分层与 FastAPI 对应关系最清晰，Java 系读者首选参考 | ✅ 92/92 | ✅ 92/92 |
| `backends/gin/` | Go + GORM + golang-migrate；高并发场景下的极简后端展示 | ✅ 92/92 | ✅ 92/92 |

#### 前端

| 实现 | 要点 | 实现 | UI 冒烟 |
|---|---|---|---|
| `frontends/vue3-ts/` | Vue 3 + Pinia；组合式 API + composables 的标准写法 | ✅ | ✅ 4/4 |
| `frontends/angular/` | Angular 19 + NgRx Signal Store；Signals + standalone components | ✅ | ✅ 4/4 |

#### 全栈

| 实现 | 要点 | 契约 PG | 契约 SQLite | UI 冒烟 |
|---|---|---|---|---|
| `fullstacks/next/` | Next.js 15 App Router + Drizzle + 同源 API Routes | ✅ 92/92 | ✅ 92/92 | ✅ 4/4 |
| `fullstacks/nuxt/` | Nuxt 3 + Nitro + Drizzle + 约定式路由 | ✅ 92/92 | ✅ 92/92 | ✅ 4/4 |

#### 已完成的横切改进（影响所有现有实现）

- **2026-05-08 · 移除 POST `/stack-narration`**：从 Gin / FastAPI / Spring Boot 三个后端删除 AI 栈叙述端点及相关服务代码，AI 叙述不贴合实际、已废弃。
- **2026-05-08 · `GET /health` 新增 `stack.summary`**：各后端自持一段真实实现描述，由 `/health` 返回给前端，无需 AI 生成。
- **2026-05-08 · 关于页面重构**：React / Vue / Angular 三套前端统一改为"简短产品介绍 + 图标行 + 一段话"布局。
- **2026-05-08 · 代理 socket 超时修复**：`scripts/hello` 内嵌 Python TCP 代理从 `timeout=5` 改为 `timeout=None`，修复 AI 生成胶囊内容时的 socket hang up。
- **2026-05-08 · AI 生成胶囊内容**：React / Vue / Angular 创建页接入 `POST /api/v1/capsule-suggestion`。
- **2026-05-11 · Next.js Postgres schema 对齐 spec**：原迁移把 UUID/TIMESTAMPTZ 降级为 TEXT，违反 spec/db/schema.sql 的"PG 用原生类型、SQLite 才降级"约定；重写迁移至 22 表/索引/扩展 + 7 个 CHECK 约束完全等价。
- **2026-05-11 · Next.js open redirect 修复**：登录 `?next=` 参数加 `safeNext()` 校验，拒绝 `//evil`、`/\evil`、`https://...`、`javascript:...` 等跨域跳转。
- **2026-05-11 · Next.js typecheck 不再依赖 `.next/types`**：从 `tsconfig.json` 移除生成路径，干净 checkout 上 `tsc --noEmit` 直接可用。

#### M2.1 遗留问题修复（2026-05-12）

> 以下修复在 M2 验收后统一处理，清单对应 M2 已知问题 1–2。

- **SQLite per-impl 文件隔离**：原先所有实现共用 `data/sqlite/hellotime.db`，多实现并发时会互踩 schema / 数据。现 `scripts/hello` 的 `_sqlite_path_for(target, base)` 为每个实现生成独立文件（`hellotime-<impl>.db`）；`verify-contract.sh` 和 `verify-ui-smoke.sh` 同步派生 per-impl 路径，彻底消除竞争。
- **Gin SQLite 401 "用户不存在"**（双 bug 根因）：
  - *Bug A · 双斜杠路径*：原 `sqliteFilePath()` 用 `url.Parse` 解析 `sqlite:////abs/path`，得到 `//abs/path`（前导双斜杠）。SQLite VFS 把 `//path` 和 `/path` 视为两个不同 lock 域，gin 写在一个域，读在另一个，INSERT 成功但 SELECT 始终返回 0 行。修复：手工剥离 `sqlite://` 前缀后再吃掉一个斜杠。
  - *Bug B · 时间列类型*：SQLite 迁移把所有 TIMESTAMP 列声明为 `TEXT`。`mattn/go-sqlite3` 只在列 declared type 含 `DATETIME` / `TIMESTAMP` 关键字时才自动把存储字符串解析为 `time.Time`；TEXT 列触发 `Scan: storing string into *time.Time` 错误，GORM 将其转为 `ErrRecordNotFound` → 每次鉴权 401。修复：迁移文件所有时间列改为 `DATETIME`。
- **Spring Boot mvn 找不到**：`hello start spring` 派生的子进程不继承 vmr / sdkman PATH 扩展，导致 `mvn: not found`。修复：在 `backends/spring-boot/run` 加 mvn 路径探测循环，覆盖 vmr、sdkman、Homebrew、`~/.m2/wrapper` 四个常见安装位置。
- **Nuxt Postgres schema 对齐 spec**：Nuxt 原迁移将所有列降为 TEXT / INTEGER，PG 契约测试后共享数据库里的 timestamp 字段变成裸字符串，FastAPI 读取时 SQLAlchemy `DateTime(timezone=True)` 报 `AttributeError: 'str' has no attribute 'tzinfo'`。修复：完全重写 `fullstacks/nuxt/drizzle/pg/0001_init.sql` 及对应 `schema-pg.ts`，与 Next.js / spec 保持一致（UUID / TIMESTAMPTZ / VARCHAR / CHAR 原生类型，全部 CHECK 约束与索引）。
- **verify-ui-smoke.sh 支持全栈（next / nuxt）**：原脚本只覆盖 react / vue / angular 纯前端，全栈实现需自带 API 而无需后端代理。现引入 `_is_fullstack()` 分支：全栈直接 `hello start <target>`，前端继续通过 `BACKEND_PROXY` 指向 `:9080`；SQLite 清理路径也按 `_SQLITE_OWNER` 正确派生（全栈用自身 target，前端用 proxy_target）。

#### 验收记录

- 2026-05-11：`DB_DRIVER=postgres ./verification/scripts/verify-contract.sh {spring,gin,next,nuxt}` 全部通过，92/92。
- 2026-05-11：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh {spring,next,nuxt}` 全部通过，92/92。
- 2026-05-11：`./verification/scripts/verify-ui-smoke.sh {react-ts,vue3-ts,angular}` 第 1 个测试稳定通过；测试 2-4 在最近一次创建页 UI 重构后出现回归。
- 2026-05-12（M2.1）：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh gin` 通过，92/92。
- 2026-05-12（M2.1）：`./verification/scripts/verify-ui-smoke.sh {react-ts,vue3-ts,angular,next,nuxt}` 全部通过，各 4/4。
- 2026-05-12（M2.1）：`DB_DRIVER={postgres,sqlite} ./verification/scripts/verify-contract.sh {fastapi,spring,gin,next,nuxt}` 全矩阵 10/10 通过。

#### M2 已知问题（已关闭 / 遗留）

1. ~~**Gin SQLite 与多实现共享 `hellotime.db`**~~：✅ 已修复（M2.1 · 2026-05-12）。per-impl 文件 + URL 解析 + DATETIME 列类型三处修复后全绿。
2. ~~**UI 冒烟测试 2-4 在前端上 timeout**~~：✅ 已修复（M2.1 · 2026-05-12）。react / vue / angular / next / nuxt 各 4/4 通过。
3. **`favorite_count` 并发漂移 / `refresh` token 并发重放窗口**（Next.js 实现）：services 层 SELECT→INSERT/DELETE→UPDATE 三段不是事务。按项目 [质量策略](../.claude/projects/-Users-alex-AiWork-HelloTimeProByClaude/memory/project_quality_policy.md) "教学项目不修生产级并发"暂不动，代码顶部已加注释说明生产化做法（transaction / `UPDATE ... WHERE revoked_at IS NULL RETURNING`）。

---

### M3 · 全面扩散（4–6 周，高度并行）

**目标**：剩余 13 个实现全部达到"契约绿"。

**状态**：🔄 **进行中（2026-05-25）** — 13 个实现中 3 个已完成（2 后端 + 1 前端），10 个待开始。

#### 后端（8 个）

| 实现 | 要点 | 契约 PG | 契约 SQLite |
|---|---|---|---|
| `backends/elysia/` | Bun + Elysia + TypeScript；原生 SQL + 轻量方言适配；与 NestJS 同为 TypeScript 生态，风格更函数式 | ✅ 92/92 | ✅ 92/92 |
| `backends/nest/` | NestJS 11 + TypeORM + Passport JWT；分层与 FastAPI / Spring Boot 对应，TS 社区标准企业框架 | ✅ 92/92 | ✅ 92/92 |
| `backends/ktor/`（待） | Kotlin + Exposed / JPA；有 Spring Boot 作参照后更顺 | — | — |
| `backends/aspnet/`（待） | ASP.NET Core + EF Core；C#，文档完备，写法独特值得一看 | — | — |
| `backends/axum/`（待） | Rust + sqlx；类型安全极致，适合展示所有权模型 | — | — |
| `backends/vapor/`（待） | Swift + Fluent；仅 macOS，排后是因为受限而不是难 | — | — |
| `backends/drogon/`（待） | C++20 + CMake；v1 工具链已趟通，排最后因编译循环慢 | — | — |

#### 前端（2 个）

| 实现 | 要点 | UI 冒烟 |
|---|---|---|
| `frontends/svelte/` | Svelte 5 Runes（`$state / $derived / $effect`）+ svelte-routing；`.svelte.ts` class 单例；Snippet 取代 slot；完整 TECHNICAL_GUIDE | ✅ 4/4 |
| `frontends/solid-ts/`（待） | SolidJS `createSignal / createResource`；细粒度响应式与 React 的心智对比 | — |

#### 全栈（3 个）

| 实现 | 要点 | 契约 PG | 契约 SQLite | UI 冒烟 |
|---|---|---|---|---|
| `fullstacks/rails/`（待） | ERB + Turbo + Hotwire；Rails 约定优于配置的全栈典范 | — | — | — |
| `fullstacks/laravel/`（待） | Blade + Alpine.js；PHP 现代全栈的最佳代表 | — | — | — |
| `fullstacks/spring-boot-mvc/`（待） | Thymeleaf + HTMX；Java 系服务端渲染，与前后端分离形成强对比 | — | — | — |

#### 已完成的横切改进

##### Elysia 落地记录（2026-05-24）

- 目录 `backends/elysia/`（端口 29030），Bun 运行时，原生 SQL 适配 PG / SQLite。
- PostgreSQL schema 使用 `UUID` 列类型（`gen_random_uuid()` 默认值）；SQLite 使用 `TEXT`——与 spec 对齐。
- 关键坑（已修复）：
  - `parseSqlitePath` 用 `"sqlite://".length`（9 位）剥离 `sqlite:///` 前缀，绝对路径变成 `//abs/path`；修复为 `.slice("sqlite:///".length)`（10 位）。
  - `readClaims` 在公开端点（广场、按码查胶囊）上遇到过期 token 会抛出 401，导致匿名浏览失败；重构为两个函数：`readClaims`（可选鉴权，错误一律返回 null）和 `requireClaims`（强制鉴权，保留 expired / invalid 精准错误码）。
  - 注册冲突检测用松散 `.includes("email")` 字符串搜索；改为精确匹配索引名正则 `/users_email_uk|users\.email/i`。
  - 创建胶囊的重试循环 catch 了所有异常，DB 错误被伪装成"唯一码碰撞"；改为只捕获 `/capsules_code_uk|capsules\.code/i` 匹配的唯一码冲突，其他异常立即抛出。
  - `refresh()` 查-校验-插入三步非事务（TOCTOU）；加 TODO 注释注明生产化做法。

##### NestJS 落地记录（2026-05-24）

- 目录 `backends/nest/`（端口 29040），NestJS 11 + TypeORM + Passport JWT。
- 双驱动适配通过 `DB_DRIVER` 环境变量切换；时间列用 `ValueTransformer` 处理 SQLite 字符串到 `Date` 的互转。
- TECHNICAL_GUIDE.md 已就位，覆盖 NestJS 分层（Controller / Service / Module / Guard / Interceptor）、TypeORM Entity 设计、SQLite/PG 双驱动适配细节。

##### Svelte 落地记录（2026-05-24 / 2026-05-25）

- 目录 `frontends/svelte`（端口 7176），不带 `-ts` 后缀但全程 TypeScript。
- 关键坑：`.svelte.ts` 单例 store 必须用**带 `.ts` 后缀**的导入路径（`@/stores/auth.svelte.ts`），否则 Vite + `@sveltejs/vite-plugin-svelte` 会同时把 `auth.svelte` 解析为"Svelte 组件"和"TS 模块"两条加载链，得到**两个不同的 store 实例**——hydrate 写入的 user 在 AppHeader 里读不到。
- 路由用一组**扁平** `<Route>` 列举所有路径并各自包裹 `MainLayout` / `MeLayout`，而不是嵌套 `<Route>`。嵌套写法在 svelte-routing 2.13 + Svelte 5 下会触发 `effect_update_depth_exceeded`（递归更新）。
- `svelte.config.js` **不开** `compilerOptions.runes: true`：svelte-routing 的 `Link.svelte` 还在用 legacy `$$restProps`，全局开 runes 会让它构建失败。
- 2026-05-25 spec 一致性修复（Codex review 5 条）：路由 `/c/:code` → `/capsules/:code` + 新增 `/plaza/:id`；已开启胶囊补删除按钮；收藏页取消收藏后移除列表项；已登录访问 `/login` / `/register` 重定向首页；匿名收藏跳转携带 `?from=` 参数。
- TECHNICAL_GUIDE.md（833 行）已就位，含 Svelte 5 Runes 核心概念、`.svelte.ts` 陷阱说明、vs React vs Vue 对照表。
- `verify-ui-smoke.sh` 已加入 `svelte / svelte-ts` 别名支持。

#### 验收记录

- 2026-05-24：`./verification/scripts/verify-contract.sh elysia` 通过，PostgreSQL 92/92。
- 2026-05-24：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh elysia` 通过，SQLite 92/92。
- 2026-05-24：`./verification/scripts/verify-contract.sh nest` 通过，PostgreSQL 92/92。
- 2026-05-24：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nest` 通过，SQLite 92/92。
- 2026-05-24：`./verification/scripts/verify-ui-smoke.sh svelte` 通过，Playwright 4/4。
- 2026-05-25：elysia bug fix 后复验 PG + SQLite 各 92/92 全绿。
- 2026-05-25：`./verification/scripts/verify-ui-smoke.sh svelte`（spec fix 后复验） 通过，4/4。
- 2026-05-25：`./verification/scripts/verify-contract.sh nest`（PG）、`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nest`（SQLite） 复验，各 92/92。

#### Spring Boot 双驱动回归修复（2026-06-02）

**现象**：`verify-contract.sh spring` 在 SQLite 下 14 例失败、Postgres 下约 66 例失败，读胶囊/收藏时报 `java.sql.SQLException: Error parsing time stamp`。

**根因**：并非时间戳单点问题，而是 2026-05-27「数据库维护解耦」（704bca9）的回归。此前各后端跑自己的 Flyway schema（spring 用 `VARCHAR(36)` id + datetime），与实体映射匹配；解耦后所有栈统一跑 `./scripts/db` 生成的 **spec 共享 schema**、Flyway 禁用，spring 的实体映射（`@JdbcTypeCode(VARCHAR)` + `OffsetDateTime↔Timestamp` 转换器）不再匹配：

- **SQLite**：seed 把时间戳存成 ISO-8601 TEXT（`2026-04-14T16:00:00+00:00`），但 sqlite-jdbc 的 `getTimestamp` 期望 `yyyy-MM-dd HH:mm:ss.SSS`，无法解析带 `T`/偏移的串 → `openAt` 读成 null → NPE；UUID 在 SQLite 是 32 位无横线 hex，Hibernate 默认按 36 位带横线读写 → `id IN (...)` 匹配不到 owner。
- **Postgres**：`@JdbcTypeCode(VARCHAR)` 把原生 `uuid`/`timestamptz` 列当 varchar 绑定 → `operator does not exist: uuid = character varying`，以及写 `revoked_at` 时 `timestamp ... but expression is character varying`。

**修复**（仅改 `backends/spring-boot/`，不动 seed/spec，其它栈不受影响）：

- 移除实体上的 `@JdbcTypeCode(VARCHAR)` 与 `OffsetDateTimeStringConverter`，让 Postgres 走原生 `uuid` / `timestamptz`。
- 新增两个**跨库 JdbcType**（`.../db/CrossDbUuidJdbcType`、`CrossDbOffsetDateTimeJdbcType`），用 `@JdbcType` 注解作用到 UUID / OffsetDateTime 字段，运行时按方言分流：SQLite 走 32 位 hex / ISO-8601 TEXT（`getString`/`setString`，输出格式与 seed 完全一致，保证字符串比较的 `open_at <= :now` 与 `ORDER BY created_at` 正确），Postgres 走原生 `setObject`/`getObject`。两者自实现 `ValueBinder`，对 **null** 也按方言给出正确的 `setNull` 类型（否则 Postgres 拒绝把 VARCHAR null 写入 `timestamptz`）。
- `run` 脚本去掉已无意义的 `?date_class=TEXT`。
- 备注：方言级类型注册（自定义 `SQLiteDialect`）行不通——community `SQLiteDialect` 在属性解析层把 UUID 映射成 VARCHAR，会绕过 `SqlTypes.UUID` 覆盖，故改用 `@JdbcType` 注解强制生效。

**验收**：

- 2026-06-02：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh spring` 通过，**104/104**。
- 2026-06-02：`./verification/scripts/verify-contract.sh spring`（Postgres） 通过，**104/104**。

---

### M4 · 打磨与发布（2 周）

**目标**：视觉 / 行为细节打磨，跨栈对比文档就绪，发布 v1.0。

**交付物**

- [ ] `docs/backend-comparison.md`、`docs/frontend-comparison.md`、`docs/fullstack-comparison.md`
- [ ] `docs/multi-stack-reading-guide.md`
- [ ] `docs/auth.md`（鉴权全流程图）
- [ ] `docs/db-schema.md`（schema 可视化）
- [ ] 所有实现 README 格式统一（对照 `docs/readme-template.md`）
- [ ] 视觉回锅：渐变 / 动效 / 微交互增强
- [ ] A11y 审查：键盘可达、WCAG AA 对比度
- [ ] 广场接口 p95 < 200ms（5 万行测试数据）
- [ ] 发布 `v1.0.0` 标签 + Release Notes

## 4. 并行策略

- `main` 分支永远可运行
- 每个实现使用 `feature/<stack>` 分支，独立 PR
- PR 合并条件：`verify-contract.sh <name>` 或 `verify-ui-smoke.sh <name>` 绿
- spec 变更必须走独立 PR，不允许夹带到实现 PR

M2 6 个实现可以完全并行。M3 后端较多，建议按上述顺序投入，越靠前越快产出；前端和全栈可与后端并行。

## 5. Definition of Done（单实现）

| 检查项 | 后端 | 前端 | 全栈 |
|---|---|---|---|
| 功能完整（按 requirements §4） | ✅ | ✅ | ✅ |
| `verify-contract.sh <name>` 绿 | ✅ | — | ✅ |
| `verify-ui-smoke.sh <name>` 绿 | — | ✅ | ✅ |
| PG + SQLite 各跑一次 | ✅ | — | ✅ |
| `./run` `./build` `./test` 存在且可运行 | ✅ | ✅ | ✅ |
| lint 无红灯 | ✅ | ✅ | ✅ |
| README 完整 | ✅ | ✅ | ✅ |
| `*-comparison.md` 对应行填写 | ✅ | ✅ | ✅ |

## 6. 风险与对策

| 风险 | 概率 | 对策 |
|---|---|---|
| Drogon 编译慢，开发循环长 | 中 | v1 工具链已趟通；排 M3 最后；增量构建 |
| Vapor 仅 macOS 阻挡自动化 | 中 | verify 脚本默认 skip Vapor；要求本地 macOS 验证 |
| Tailwind 在 Angular 模板里写得乱 | 中 | Angular 允许用 SCSS + token class 做组件级封装 |
| `favorite_count` 冗余计数漂移 | 低 | 契约验证覆盖并发收藏场景 |
| spec 被各栈悄悄偏离 | 中 | `verify-contract.sh` 强制 fail；spec PR 作为合并门槛 |

## 7. 估算与节奏

| 阶段 | 估算 | 累计 |
|---|---|---|
| M0 · 设计基础 | 1.5 周 | 1.5 周 |
| M1 · 参考栈 | 2.5 周 | 4 周 |
| M2 · 第一批（6 实现并行） | 3 周 | 7 周 |
| M3 · 全面扩散（13 实现高度并行） | 5 周 | 12 周 |
| M4 · 打磨发布 | 2 周 | **14 周（≈ 3.5 个月）** |

**分阶段发布标签**

| 标签 | 条件 |
|---|---|
| `v0.1` | M0：设计稿 + 工具链 |
| `v0.2` | M1：FastAPI + React 可跑 |
| `v0.5` | M2：第一批 6 实现全绿 |
| `v0.9` | M3：全部 20 实现全绿 |
| `v1.0` | M4：文档 + 打磨完成 |

## 8. 新开发者起手式

1. 读完 `docs/01–03`
2. 打开 `ui-prototype/index.html` 对照 `01-requirements.md §4.7` 看设计意图
3. `docker compose up -d postgres` + `./scripts/hello start fastapi react-ts`
4. 跑 `verify-contract.sh fastapi` 和 `verify-ui-smoke.sh react-ts`
5. 挑一个 M2 / M3 的实现，开 `feature/<stack>` 分支，参照 FastAPI 的目录结构动手

## 9. 已决问题归档

| 问题 | 决定 |
|---|---|
| 参考栈选哪个？ | FastAPI（后端）+ React（前端） |
| 胶囊可以删除吗？ | 可以（MUST），但不可编辑内容或修改开启时间 |
| Drogon 是否硬性列入 M2？ | 否，列入 M3 最后一个，v1 工具链可复用 |
| 热度算法？ | 纯收藏数降序，无衰减 |
| 匿名收藏？ | 前端弹登录提示，不静默失败 |
