# HelloTime Pro 开发规划

> 版本 0.3 · 2026-06-20 · 面向对象：新加入本项目的开发者 / 阅读者

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
                                   │
                                   ▼
                      M5 全端扩散（复用 20 实现之后）
                      ├─ 桌面：Tauri · Electron · SwiftUI · WinUI 3 · Qt/PySide · Flutter
                      └─ 移动：React Native · iOS · Android · Flutter · 微信小程序
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

**状态**：✅ **已完成并验收（2026-06-13）** — 全部 13 个实现落地：后端 8/8（elysia · nest · ktor · aspnet · vapor · axum · drogon，以及 M3 最后一个 drogon 于 06-13 完成）；前端 2/2（svelte · solid）；全栈 3/3（spring-mvc · rails · laravel）。所有实现均通过双驱动契约验证。

#### 后端（8 个）

| 实现 | 要点 | 契约 PG | 契约 SQLite |
|---|---|---|---|
| `backends/elysia/` | Bun + Elysia + TypeScript；原生 SQL + 轻量方言适配；与 NestJS 同为 TypeScript 生态，风格更函数式 | ✅ 92/92 | ✅ 92/92 |
| `backends/nest/` | NestJS 11 + TypeORM + Passport JWT；分层与 FastAPI / Spring Boot 对应，TS 社区标准企业框架 | ✅ 92/92 | ✅ 92/92 |
| `backends/ktor/` | Kotlin + Exposed + HikariCP；`CrossDbColumns` 按方言分流列读写（2026-06-05 落地） | ✅ 104/104 | ✅ 104/104 |
| `backends/aspnet/` | ASP.NET Core + EF Core 8；接管 SQLite 的 DateTimeOffset 存储格式保住字符串比较（2026-06-06 落地） | ✅ 104/104 | ✅ 104/104 |
| `backends/axum/` | Rust + Axum 0.8 + sqlx 手写 SQL（Value/Cell 跨库编解码层，`?` 占位 PG 端转 `$n`）；SQLite 池上限 1 串行化（2026-06-12 落地） | ✅ 104/104 | ✅ 104/104 |
| `backends/vapor/` | Swift + Vapor 4 + SQLKit 手写 SQL（跨库值编解码层）；仅 macOS（2026-06-12 落地，Swift 包在 `server/` 子目录避开 SwiftPM 目录身份与依赖 `vapor` 的冲突） | ✅ 104/104 | ✅ 104/104 |
| `backends/drogon/` | C++20 + Drogon 1.9 + 协程；文本化跨库编解码（PG 文本协议推断 / SQLite 列亲和性）；显式 awaitCommit 修复异步析构提交竞态；bcrypt 复用仓内 nest 的 OpenBSD 源（2026-06-13 落地） | ✅ 104/104 | ✅ 104/104 |

#### 前端（2 个）

| 实现 | 要点 | UI 冒烟 |
|---|---|---|
| `frontends/svelte/` | Svelte 5 Runes（`$state / $derived / $effect`）+ svelte-routing；`.svelte.ts` class 单例；Snippet 取代 slot；完整 TECHNICAL_GUIDE | ✅ 25/25 |
| `frontends/solid/` | SolidJS `createSignal / createStore`（细粒度响应式，无虚拟 DOM）+ `@solidjs/router`；模块级 Store 脱离组件树；与 React 的心智对比 | ✅ 25/25 |

#### 全栈（3 个）

| 实现 | 要点 | 契约 PG | 契约 SQLite | UI 冒烟 |
|---|---|---|---|---|
| `fullstacks/rails/` | ERB + Turbo + Hotwire；Rails 约定优于配置的全栈典范（2026-06-06 落地） | ✅ 104/104 | ✅ 104/104 | ✅ 25/25 |
| `fullstacks/laravel/` | Blade + Alpine.js；PHP 现代全栈的最佳代表；Eloquent ORM 重构（2026-06-10 落地） | ✅ 104/104 | ✅ 104/104 | ✅ 25/25（SQLite） |
| `fullstacks/spring-mvc/` | Thymeleaf + HTMX；Java 系服务端渲染，与前后端分离形成强对比（hello 登记名 `spring-mvc`，端口 7179） | ✅ 104/104 | ✅ 104/104 | ✅ 25/25 |

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

##### SolidJS 落地记录（2026-06-03）

- 目录 `frontends/solid`（端口 7180），不带 `-ts` 后缀但全程 TypeScript。SolidJS 1.9 + `@solidjs/router` 0.16 + `vite-plugin-solid` + Tailwind v4。
- **逻辑层逐字复用 react-ts**：`api/client.ts`、`types/index.ts`、`utils/{avatar,format}.ts` 及其单测原样复制（纯 TS、框架无关），真正体现契约驱动多栈「业务逻辑与框架解耦」。UI 层（stores / components / pages）用 SolidJS 习惯写法重写。
- **状态层**：全局状态用模块级 `createSignal`（theme）/ `createStore`（auth、plaza、capsule）+ 导出动作函数，脱离组件树存在，角色等同 react-ts 的 Zustand；并发请求沿用闭包「序列号」守卫。`auth.ts` 启动时 `configureApi()` 注入 token 读取回调，与 client 解耦避免循环依赖。
- **路由**：`@solidjs/router` 嵌套 `<Route>`，父布局组件经 `props.children` 渲染 outlet；`AuthGate` 用双层 `<Show>`（先等 hydrate 再判登录态）声明式守卫；路由保持 react-ts 的 `/c/:code`（`verify-ui-smoke` 的 `capsulePath` 对非 svelte 即返回 `/c/`，无需改测试）。
- 关键 SolidJS 注意点（已落实）：
  - **props 不解构**，一律 `props.x` 访问以保持响应性；默认值用 `() => props.x ?? d`。
  - 控制流用 `<Show>` / `<For>` / `<Index>`；8 位胶囊码格子用 `<Index>`（定长按位 keyed）最贴切。
  - `style` 对象键用 **kebab-case 字符串、值带单位**（`{ "margin-left": "auto", gap: "6px" }`），SVG 属性用原生 `stroke-width` 等——与 React 的 camelCase + 自动 px 不同。
  - 计时器用 `window.setTimeout/clearTimeout` 拿 `number` 返回值，否则装了 `@types/node` 时类型推断为 `Timeout`、对显式 `number` 标注报错（lint 唯一暴露的两处问题，已修）。
- `verify-ui-smoke.sh` 已加入 `solid / solid-ts` 别名与 case 支持；`scripts/hello` 早已登记 `solid`（端口 7180）。
- README + TECHNICAL_GUIDE 已就位，后者含 SolidJS 细粒度响应式核心概念与 vs React / Vue / Svelte 对照表。

#### 验收记录

- 2026-05-24：`./verification/scripts/verify-contract.sh elysia` 通过，PostgreSQL 92/92。
- 2026-05-24：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh elysia` 通过，SQLite 92/92。
- 2026-05-24：`./verification/scripts/verify-contract.sh nest` 通过，PostgreSQL 92/92。
- 2026-05-24：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nest` 通过，SQLite 92/92。
- 2026-05-24：`./verification/scripts/verify-ui-smoke.sh svelte` 通过，Playwright 4/4。
- 2026-05-25：elysia bug fix 后复验 PG + SQLite 各 92/92 全绿。
- 2026-05-25：`./verification/scripts/verify-ui-smoke.sh svelte`（spec fix 后复验） 通过，4/4。
- 2026-05-25：`./verification/scripts/verify-contract.sh nest`（PG）、`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nest`（SQLite） 复验，各 92/92。
- 2026-06-03：`./verification/scripts/verify-ui-smoke.sh solid` 通过，Playwright **25/25**（一次通过；后端 gin / PostgreSQL，经 :9080 代理）。`npm run lint`（tsc）零错、`npm test` 7/7、`./build` 成功。

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

#### AI 胶囊灵感功能全栈扩散（2026-06-02）

**背景**：参考栈（FastAPI + React）先行落地两项 AI 增强，随后同步到其余 8 个实现。

**功能增量**（每个实现）：

1. **空标题也能 AI 生成**：`POST /capsule-suggestion` 的 `title` 由必填改为可选；留空时 LLM 同时产出标题 + 正文 + 建议开启天数，前端回填标题。本地兜底在空标题模式返回 `(title, content, days)`。
2. **AI 推荐主题区**：新增 `GET /capsule-recommendations`（公开，`count` 3–8 默认 4；LLM 不可用返回空数组、静默、不本地兜底）。前端创建页异步加载推荐 chip，空标题时显示，点击直接生成整条胶囊；"换一批"用序号守卫防竞态、空列表不覆盖已有推荐。
3. **LLM 客户端可靠性**（各后端）：结构化日志 `LLM request/response/error`（规范见 CLAUDE.md / AGENTS.md / GEMINI.md）；瞬时网络/TLS 错误（SSL EOF）重试；浏览器 UA 规避 Cloudflare 1010；默认 `chat` 风格跳过多数网关不支持的 `/responses`。

**契约 / UI 用例随之扩展**：黑盒契约 92 → **104**（新增 6 suggestion + 6 recommendation）；UI 冒烟 20 → **25**（新增 5 个 AI 推荐用例，用 Playwright route mock 保证确定性）。

**覆盖范围**：`spec/`（契约 + prompt 模板，单一源）+ 后端 gin / nest / elysia / spring-boot + 前端 vue3-ts / svelte / angular + 全栈 next / nuxt，共 9 个实现全部对齐参考栈。

##### next / nuxt 收尾修复（2026-06-02）

超时噪音清除后，两个全栈各暴露一个与 AI 特性无关的既有问题，一并修复：

- **next run 改生产构建启动**：原 `next dev` 懒编译让 Playwright 首次访问各路由现场编译，在负载机上撞穿导航超时（每轮失败集不同、4.5–7.4 min）。改为 `next build` + `next start`（与 nuxt 全栈一致），预编译全部路由 → 整轮 ~14s 稳定。需热重载开发时改用 `npm run dev`。
- **整页 reload 误登出（next + nuxt 同源）**：登录后 `/register → /` 全页导航序列会误登出。根因是启动时**急切刷新**（next 的 `auth-store.hydrate()` 调 `api.me()`；nuxt 的 `bootstrap.client` 调 `refreshMe()`）：上一页刷新轮换并吊销了 refresh token，响应未及持久化就被下一次导航打断，下一页用旧 token 再刷新触发**重用检测 → 整族吊销 → 误登出**。修复：登录态由持久化的 `user`（zustand persist / store hydrate 已同步恢复）渲染，access token 改由真正的 authed 请求惰性刷新，refresh token 在单页内只轮换一次。
- **nuxt about 文案对齐**：分区标题"应用/服务端技术栈" → "前端/后端技术栈"（与契约/其它实现一致）。
- **AI 建议端点公开性修复**：next / nuxt 的 `POST /api/v1/capsule-suggestion` 误沿用 `requireClaims`，匿名请求返回 401；契约规定该端点为公开创建辅助。移除鉴权后，公开请求返回 200，超长标题仍按校验返回 422。
- **Node 26 SQLite native 依赖修复**：next / nuxt 锁定的 `better-sqlite3@11.10.0` 不兼容 Node v26 ABI（`NODE_MODULE_VERSION 147`），SQLite 模式迁移阶段无法启动。升级到 `better-sqlite3@12.10.0`，该版本声明支持 Node 20/22/23/24/25/26。

**验收**：

- 2026-06-02：`DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh gin` 通过，**104/104**。
- 2026-06-02：6 套前端 / 全栈 `verify-ui-smoke.sh {react-ts,vue3-ts,svelte,angular,next,nuxt}` 全部 **25/25** 通过；next / nuxt 各连续两轮稳过（~14s）。
- 2026-06-02：全栈契约双数据库复验全绿：`next` PostgreSQL **104/104**、`next` SQLite **104/104**、`nuxt` PostgreSQL **104/104**、`nuxt` SQLite **104/104**。

#### Spring MVC 全栈落地记录（2026-06-04）

- 目录 `fullstacks/spring-mvc/`（hello 登记名 `spring-mvc`，端口 7179，runtime jdk）。Java 21 + Spring Boot 3.3 + **Thymeleaf + HTMX** 服务端渲染，是全栈矩阵里唯一的「前后端不分离」代表。
- **一个进程两套接口**：业务地基（domain/repository/service/db 跨库 JdbcType/JWT/LLM 客户端 + `web/` JSON 控制器）逐字复用 `backends/spring-boot`；新增 `web/view/` 的 SSR 控制器、cookie 鉴权桥、Thymeleaf 模板、`app.js`、Tailwind 构建。同时对外暴露 `/api/v1` JSON 契约（Bearer）与 SSR 页面（httpOnly cookie）。
- **cookie ↔ Bearer 打通**：`CookieTokenFilter` 在 `/api/v1/*` 缺 Authorization 头但带 `ht_access` cookie 时，包装请求注入 `Bearer`，让浏览器 fetch 复用同一套 JSON 控制器鉴权（`me.spec` 要求改资料命中 `PATCH /api/v1/me`）。仅在缺头时介入，不影响契约黑盒（真实 Bearer）与「无鉴权 → 401」。
- **HTMX / 原生 JS 分工**：广场搜索、撤回走 HTMX 片段；AI 灵感/生成（JSON envelope，HTMX 不适用）、8 位码、头像、表单校验、收藏走 `app.js`。
- 关键坑（已修复）：
  - **收藏竞态**：「点收藏后立刻 `goto('/me/favorites')`」会中止在途异步 XHR，PG 上（FOR UPDATE 行锁略慢）稳定输掉竞态、收藏未提交即被静态 SSR 页查询读到。改用**同步 `XMLHttpRequest`** 保证收藏在导航前落库提交；匿名点击纯客户端 `confirm` 跳登录（`keepalive` 不足以保证提交-查询顺序）。
  - **Thymeleaf `th:replace` 优先级高于 `th:each`**：同元素上 replace 先于迭代执行 → 循环变量为 null。必须外层 each、内层 replace，且 fragment 用命名传参、参数名与签名一致。
  - **`hx-trigger` 用 `input` 而非 `keyup`**：Playwright `fill()` 只派发 `input`，用 `keyup` 搜索永不触发。
  - **端口默认值**：`hello start` 不注入 PORT，`application.yml` 默认端口必须直接是 7179。
  - **JVM 冷启动慢**：`verify-ui-smoke.sh` 就绪等待 30s→120s（命中即退出，不影响其它栈）。
  - **孤儿胶囊防御**：`PlazaService` 跳过 owner 已删除的胶囊（SQLite 外键默认不级联），避免 SSR 首页 `/` 查广场时对 null owner 取 nickname 抛 NPE 致 500。
  - **`./test`**：Flyway 已随 db 解耦禁用，测试库 schema 改由 `scripts/db init` 创建（与 app 运行一致）。
- README + TECHNICAL_GUIDE 已就位；`verify-ui-smoke.sh` 加入 `spring-mvc`（白名单 + `_is_fullstack`）。

**验收**：

- 2026-06-04：`./verification/scripts/verify-contract.sh spring-mvc`（PostgreSQL） 通过，**104/104**；`DB_DRIVER=sqlite ...` 通过，**104/104**。
- 2026-06-04：`./verification/scripts/verify-ui-smoke.sh spring-mvc`（PostgreSQL） 通过，**25/25**（~13.7s）；`DB_DRIVER=sqlite ...` 通过，**25/25**（~12.8s）。
- 2026-06-04：`./build` 打包可执行 jar 成功；`./test` SmokeTest **2/2** 通过。

#### Rails 全栈落地验收（2026-06-06）

- 2026-06-06：`./verification/scripts/verify-contract.sh rails`（PostgreSQL） 通过，**104/104**；`DB_DRIVER=sqlite ...` 通过，**104/104**。
- 2026-06-06：`./verification/scripts/verify-ui-smoke.sh rails`（PostgreSQL） 通过，**25/25**；`DB_DRIVER=sqlite ...` 通过，**25/25**。

#### Laravel 全栈落地验收（2026-06-10 / 06-11）

- 2026-06-10：`./verification/scripts/verify-contract.sh laravel`（PostgreSQL） 通过，**104/104**；`DB_DRIVER=sqlite ...` 通过，**104/104**（Eloquent ORM 重构后）。
- 2026-06-11：`./verification/scripts/verify-ui-smoke.sh laravel`（SQLite） 通过，**25/25**。

#### M3 总验收

全部 13 个实现（8 后端 + 2 前端 + 3 全栈）均完成双驱动契约与 UI 冒烟验证。**M3 于 2026-06-13 drogon 落地后全员绿灯，20 个实现全部就位。**

---

### M4 · 打磨与发布（2 周）

**目标**：视觉 / 行为细节打磨，跨栈对比文档就绪，发布 v1.0。

**状态**：🔄 **进行中（2026-06-14）** — 三套对比文档与三套 review 已就位；鉴权 / schema / README 模板三份规范文档于 2026-06-14 补齐。剩余：阅读导览、视觉打磨、A11y、压测、发布标签。

**交付物**

- [x] `docs/backend-comparison.md`（全 10 家，2026-06-13 扩写完成）
- [x] `docs/frontend-comparison.md`、`docs/fullstack-comparison.md`（各 5 家，2026-06-05 / 06-10）
- [x] `docs/backend-review.md`、`docs/frontend-review.md`、`docs/fullstack-review.md`（逐行精读评分）
- [x] `docs/auth.md`（鉴权全流程：令牌策略 / rotate+family / 改密吊销 / 前端协作，2026-06-14）
- [x] `docs/db-schema.md`（ERD + 字段级注解 + 跨库方言映射，2026-06-14）
- [x] `docs/readme-template.md` + README 对齐（模板 + 对齐审计；nuxt 重写、nest 补实现特色，2026-06-14）
- [ ] `docs/multi-stack-reading-guide.md`
- [ ] 视觉回锅：渐变 / 动效 / 微交互增强
- [ ] A11y 审查：键盘可达、WCAG AA 对比度
- [ ] 广场接口 p95 < 200ms（5 万行测试数据）
- [ ] 发布 `v1.0.0` 标签 + Release Notes

---

### M5 · 全端扩散：桌面端 + 移动端（进行中）

**状态**：🔄 **进行中（更新至 2026-07-01）** — 规划已定档。桌面端 6 个里 **5 个已落地并端到端验证**：electron + tauri（Web 壳，06-20）、swiftui（首个纯原生，06-21）、flutter（自绘引擎，06-24）、qt-pyside（QML+Python，首个 Linux 原生，06-25）；剩 winui3（需 Windows 机）。移动端 5 个里 **3 个已落地**：react-native（首个移动端，06-23）、ios（SwiftUI 原生，与 macOS 端共享逻辑，06-29）、flutter（一码多端，与桌面同源工程，iOS 目标 07-01）；剩 android、wechat 小程序。详见下「桌面 / 移动客户端落地记录」。在 v1.0 既有 20 个 Web 实现之上，新增 `desktop/`（6 个）与 `mobile/`（5 个）两大类目，共 11 个客户端实现。所有客户端均为**纯 API 消费者**，复用已绿的 10 套后端与 `/api/v1` 契约，不新增任何后端 / 数据库代码。

**核心定位**：后端 / 契约 / 数据库**零增量**，全部复用。真正的工程增量只有两处——① 设计令牌从 CSS 翻译到各原生体系（codegen）；② 验证体系，Playwright 只懂 DOM，原生端需引入平台专属工具链。这两点构成 M5 的全部技术重量。

#### 类目与实现

**桌面端（`desktop/`，6 个）**

| 实现 | 范式 | 要点 |
|---|---|---|
| `desktop/tauri/` | Rust 壳 + 系统 WebView | 轻量（~3–10MB）；**内嵌 Svelte/Solid**；原生桥走 `#[tauri::command]` + Rust；与 `backends/axum` 的 Rust 呼应 |
| `desktop/electron/` | 自带 Chromium 壳 | 业界事实标准（~100–200MB）；**内嵌 React**；原生桥走 Node `fs` + IPC；Playwright 原生支持其 E2E |

> **Electron vs Tauri 差异化（避免重复）**：两者壳层哲学相反——「自带引擎 vs 借系统 WebView」「JS 壳 vs Rust 壳」，是真实世界做桌面 Web 应用的核心选择题。为让对比成为承重墙而非一张包体积表：① **内嵌不同前端**（Electron→React，Tauri→Svelte/Solid），各自多演示一套 SPA 接壳；② **各真用一次原生桥**——同一功能「导出我的胶囊到本地文件」，Electron 走 Node `fs` + IPC、Tauri 走 Rust `command`，让 IPC/命令模型差异落到代码里。
| `desktop/swiftui/` | macOS 原生声明式 UI | SF 字体 + Material 模糊，平台原生质感；**仅 Apple 平台** |
| `desktop/winui3/` | Windows 原生（WinAppSDK） | Fluent + Mica/Acrylic；**需 Windows 工具链**（已有 Windows 机）；**仅 Windows** |
| `desktop/qt-pyside/` | Qt Quick/QML + PySide6（自绘引擎） | 声明式 QML + Python 逻辑；跨 Linux/mac/Win 同源；**项目首个 Linux 原生桌面**；呼应 `backends/fastapi` 的 Python |
| `desktop/flutter/` | 一码多端（与 `mobile/flutter` 同源工程） | Skia/Impeller 自绘；`flutter run -d macos/linux`，桌面布局分支；Linux 桌面亦覆盖 |

> **Linux 原生桌面怎么覆盖**：原 5 个桌面里 swiftui 仅 macOS、winui3 仅 Windows、electron/tauri 是 Web 壳，真正在 Linux 上「编译型 + 非 webview」落地的只有 Flutter。新增 `desktop/qt-pyside` 作为**第二个 Linux 可跑的原生桌面**，把桌面增至 6 个，让 Linux 桌面有两套自绘跨端答案可对照。
>
> **Qt/PySide vs Flutter 差异化（避免重复）**：两者同属「**自绘引擎跨端、外观非系统原生**」一类（区别于 swiftui/winui3 的系统原生外观），但承重对比清晰——**语言/引擎**：Qt = 成熟 C++ 引擎 + Python(PySide6) 绑定 + QML 声明式 DSL；Flutter = Dart + Skia/Impeller，桌面与移动**单工程**同源。Qt 演示「声明式标记 + 脚本语言逻辑」的经典组合，Flutter 演示「一份代码桌面+移动双投影」，各自不可替代。

**移动端（`mobile/`，5 个）**

| 实现 | 范式 | 要点 |
|---|---|---|
| `mobile/react-native/` | JS + 原生组件桥接 | 与 `frontends/react-ts` 形成「Web React vs Native React」对照 |
| `mobile/ios/` | SwiftUI 原生 | 暗色 + 霓虹视觉贴合 iOS 审美，辉光近乎免费 |
| `mobile/android/` | Jetpack Compose 原生 | 辉光需 `Modifier.blur` / 手绘径向渐变补偿（Material 阴影仅高度模型） |
| `mobile/flutter/` | 一码多端（与 `desktop/flutter` 同源工程） | `flutter run -d ios/android`，移动布局分支 |
| `mobile/wechat-miniprogram/` | WXML / WXSS 原生 | 自成体系，`wx.request` 调后端；本地用「测试号」AppID 即可 |

> **Flutter 单工程双类目**：`desktop/flutter` 与 `mobile/flutter` 指向**同一份代码**（软链或目录指针），不复制。一套 Flutter 工程同时跑桌面与移动目标，正是「一码多端」要演示的课。

#### 共享策略：分层共享，布局分叉

桌面与移动是**两套独立 UI 基线**，强行共享布局有害而无益。共享只发生在「下半身」：

| 层 | 跨桌面/移动共享 | 说明 |
|---|---|---|
| API 契约 / 数据模型 / 错误码 | ✅ 100% | 同一套 `/api/v1` |
| 设计令牌（色 / 间距 / 圆角 / 辉光语义） | ✅ 100% | 经 codegen 落地，四端同源 |
| 业务逻辑（JWT 刷新 / 收藏计数 / 胶囊开启判定） | ✅ 大部分 | 纯逻辑，与渲染无关 |
| 布局 / 导航 / 组件树 | ❌ 不共享 | 桌面顶部 nav vs 移动底部 Tab Bar，两套 IA |

**UI 基线**：
- **桌面端** → 对标现有 Web 桌面原型（`ui-prototype/*.html`，顶部导航、多列宽屏）。
- **移动端** → 对标 `ui-prototype/mobile.html`（底部 Tab Bar：广场 / 开启 / 创建 / 我的 + splash + bottom sheet + 安全区，已是完整移动 IA）。
- **Flutter** 一工程内用 `LayoutBuilder` 按断点切换两套布局：共享 widget 库与逻辑，骨架分叉——实证「逻辑/令牌共享 + 布局分叉」的正确姿势。

#### 设计令牌跨端 codegen（新建管线）

原生端吃不了 `tokens.css`。从 `spec/styles/tokens.json` 生成各平台令牌文件，作为契约下沿：

| 目标 | 产物 |
|---|---|
| SwiftUI / iOS | `Tokens.swift`（Color / CGFloat 常量）或 Asset Catalog |
| WinUI 3 | `Tokens.xaml`（ResourceDictionary） |
| Android | `colors.xml` + Compose `Theme.kt` |
| Flutter | `tokens.dart`（ThemeData） |
| Qt Quick/QML | `palette.py`（Python dict：DARK/LIGHT/GRADIENTS/SIZES）→ 经 `ThemeStore.colors` 暴露给 QML |
| React Native | `tokens.ts`（复用现有 JSON 消费链） |
| 微信小程序 | `tokens.wxss`（CSS 变量，新基础库支持） |

配套扩展 `verify-design-tokens`，保证各端令牌与 `tokens.json` 同源不漂移——这是「四端视觉一致」唯一的硬约束。

#### 编排与端口

`scripts/hello` 现假设「一实现 = 一 HTTP 端口」（`status` 靠探端口），但原生 App 不绑稳定端口，需分两类登记：

| 类型 | 实现 | 登记 | 就绪探测 |
|---|---|---|---|
| Web 背书 | tauri / electron / react-native(Metro) / flutter-web | 端口（7190–7199 段） | 探端口 |
| 纯原生 | swiftui / qt-pyside / winui3 / ios / android / flutter-native / 小程序 | `port: null` | 自定义 / 手动 |

**`hello` 需小改**：允许 `port: null` 实现走「启动脚本 + 自定义 readiness」，否则 `status` 误报红。代理/配置：Web 背书类沿用 `:9080` 代理；原生类经构建配置注入 `BASE_URL`（模拟器可达 `localhost`，真机用 LAN IP）。

#### 验证分层

104 契约 + 25 UI smoke 无法原样平移，按渲染技术分层：

| 层 | 适用 | 工具 | 目标 |
|---|---|---|---|
| 契约 | 全部 | 复用后端已绿的 104 | 客户端**继承**后端契约，自身不重复跑 |
| Web-E2E | electron / tauri | Playwright（Electron 原生支持；Tauri 走 tauri-driver） | 力争对齐 25 smoke |
| 原生-E2E | ios / android / react-native / flutter / qt-pyside | XCUITest / Espresso·Compose-test / Maestro / `integration_test` / `pytest-qt`（或 Squish） | 跑**核心旅程子集**（登录 → 建胶囊 → 开启 → 收藏），非全 25 |
| 小程序 | wechat | `miniprogram-automator` + DevTools CLI | 核心旅程子集 |
| 人工兜底 | 自动化性价比低者 | 截图 + checklist | 文档留证 |

> 原生端是否需追平 25 条、抑或「核心旅程 + 截图留证」即可——**待决（见下）**。

#### 平台可行性 & 环境

| 实现 | Mac 可构建 | 工具链 | 环境备注 |
|---|---|---|---|
| tauri | ✅ | Rust + Vite | — |
| electron | ✅ | Node | — |
| swiftui (desktop) | ✅ | SwiftPM（Swift 6.2，无需 .xcodeproj） | ✅ 已落地（2026-06-21） |
| winui3 | ❌ 需 Windows | VS + WinAppSDK | **已有 Windows 机**，在该机上构建验证 |
| flutter | ✅（除 Windows 桌面） | Flutter SDK（git clone ~/development/flutter） | ✅ 桌面已落地（2026-06-24）、移动 iOS 已落地（2026-07-01，与桌面同源工程）；Windows 桌面 / Android 目标待各自工具链 |
| qt-pyside | ✅ | PySide6（uv，Qt 6.11） | ✅ 已落地（2026-06-25）；跨 Linux/mac/Win 同源，Linux 上即原生桌面 |
| react-native | ✅ | Metro + Xcode/Android SDK | — |
| ios | ✅ | Xcode + XcodeGen | ✅ 已落地（2026-06-29）；iOS 模拟器运行时 26.3 已装 |
| android | ✅ | Android SDK | **本机暂无 Android SDK**，flutter/RN/原生 android 目标的 apk 构建均待 SDK 安装 |
| wechat 小程序 | ✅ | 微信开发者工具 | 本地「测试号」即可；真机扫码才需注册个人 AppID（免费，~10min） |

#### 分批落地

- **M5.1 · 基础设施先行（无 UI）**：`hello` 支持 `port: null` + `desktop/` `mobile/` 类目识别；tokens codegen 管线 + `verify-design-tokens` 扩展；定义「核心旅程 smoke」用例规格。
- **M5.2 · Web 背书优先（复用度最高，趟平流程）**：electron → tauri → react-native → flutter，最大化复用现有前端代码与 Playwright，跑通端口 / 代理 / 令牌 / E2E 全链路。
- **M5.3 · 纯原生收尾（单平台、工具链各异）**：ios → android → swiftui(desktop) → qt-pyside → wechat → **winui3 最后**（在 Windows 机上）。qt-pyside 虽 Mac 可构建，但属纯原生（PySide6 进程、无 dev server），归此波。

排序逻辑同 Drogon / Vapor：环境最贵、复用最低的留到流程成熟时再上。

#### 客户端版 DoD

| 检查项 | Web 背书 | 原生 | 小程序 |
|---|---|---|---|
| 功能完整（requirements §4） | ✅ | ✅ | ✅ |
| 令牌由 codegen 生成、不漂移 | ✅ | ✅ | ✅ |
| 核心旅程 E2E 绿（或人工留证） | ✅ Playwright | ✅ 原生工具 | ✅ automator |
| `./run` `./build` 存在 | ✅ | ✅ | ✅（DevTools CLI） |
| README + `*-comparison.md` 对应行 | ✅ | ✅ | ✅ |

新建 `docs/desktop-comparison.md`、`docs/mobile-comparison.md`（沿用现有 `*-comparison.md` 体例）。

#### 待决项

1. **原生端验证严格度**：接受「~6 条核心旅程 + 截图留证」，还是追平 25 条 Playwright？（swiftui 首例已按「核心旅程截图留证 + 连通性」走；XCUITest 追平 25 条列为后续）

#### 桌面客户端落地记录

##### Electron + Tauri 落地（2026-06-20）

- `scripts/hello` 新增 `DESKTOP` 登记表（`all_stacks()` 合并 `kind="desktop"`）：`electron`(7190) / `tauri`(7191)，取 7190–7199 段避开 SPA 端口。沿用既有「探端口即就绪」模型，无需 `port: null`。
- **dev 模式嵌入**：桌面壳 `./run` 拉起兄弟前端的 Vite dev server（electron→`frontends/react-ts`@7190，tauri→`frontends/svelte`@7191），前端自带的 `/api → :9080` 代理原样复用 —— 桌面壳不碰 API 契约。退出时 trap 连带停 Vite 子进程。
- **差异化已落实**（避免两壳重复）：
  - `desktop/electron/`：自带 Chromium + Node 壳 + `main.cjs`/`preload.cjs`（`contextIsolation` + `contextBridge`）。原生菜单「胶囊 → 导出应用信息为 JSON…」演示 `native menu / IPC → Node fs + dialog`，走公开 `/api/v1/health`。
  - `desktop/tauri/`：系统 WebView + Rust 壳（`src-tauri/src/lib.rs`），`#[tauri::command]` + `tauri-plugin-dialog` + `std::fs`，能力在 `capabilities/default.json`（`dialog:default`）。刻意不在壳层抓后端健康（Rust 需 reqwest 重编译，Node 自带 fetch）—— 不对称即教学点。
- **鉴权版「导出我的胶囊」未做**：React/Svelte 把 access token 只放内存，壳层 out-of-band 调 `/auth/refresh` 会轮换吊销→误登出（next/nuxt 旧坑）。正解是 desktop-aware 前端经桥主动交数据；挂载点已就绪，列为后续。
- `identifier` 由脚手架默认 `com.tauri.dev`（保留值，build 会拒）改为 `pro.hellotime.tauri`。

**验收**：

- 2026-06-20：`hello start electron` → 内嵌 React 在 :7190 服务（`<title>HelloTime Pro · React</title>`），Electron 33.4.11 壳进程起、窗口出现，`./build`（语法检查）过；`hello stop electron` 干净停、端口释放、无残留。
- 2026-06-20：`hello start tauri` → 内嵌 Svelte 在 :7191 服务（`<title>HelloTime Pro · Svelte 5</title>`），`cargo check` 过、`tauri dev` 首次 build 50.7s 后 `Running target/debug/app` 窗口出现；`hello stop tauri` 干净停、端口释放。
- 待补：核心旅程截图留证（按 M5 验证分层），及 README/comparison 文档对应行。

##### SwiftUI 落地（2026-06-21）—— 首个纯原生桌面端

- **质变的第三个答案**：electron/tauri 都是 Web 壳（内嵌 webview），swiftui **零 webview、零内嵌 SPA**，整套 UI 用 SwiftUI 声明式重建。M5.2（Web 背书）→ M5.3（纯原生）的转折点，与 `backends/vapor`（Swift）呼应。
- **工程形态**：纯 SwiftPM 可执行包（无 `.xcodeproj`，呼应 vapor）。`Package.swift` `executableTarget` + `swiftLanguageMode(.v5)`（Swift 6 严格并发对教学示例是过度仪式，关键状态仍 `@MainActor`）。
- **分层**：`Theme/Tokens.swift`（镜像 tokens.css+palette.css 深色主题）/ `Models`（Codable 对齐 spec）/ `Networking/APIClient`（URLSession async/await + Envelope 解码）/ `Stores/AppStore`（`@Observable`+`@MainActor`）/ `Views`（顶部 nav 多列宽屏）。
- **直连不走代理**：原生无 Vite、无 `/api` 代理，`URLSession` 直打 `:9080`（`BACKEND_PROXY` 可覆盖），原生请求无 CORS。
- **`hello` 支持 `port: None`**：`DESKTOP` 登记 `swiftui`(port=None)；`op_start` 对 None 端口跳过端口探测、改以进程存活判就绪；`status` 端口列显示 `native`；`list`/`status` 排序与渲染兼容 None。这是 M5.1 规划的 `port: null` 能力的首次落地（电子/tauri 因有 dev server 端口未触发）。
- **`.app` bundle 组装**：`run` 在 `swift build` 后把二进制塞进 `.build/HelloTime Pro.app/Contents/MacOS`（配 `Resources/Info.plist`，id `pro.hellotime.swiftui`）再前台 exec —— 裸可执行文件无 bundle id（Dock 名/图标缺失、系统无法识别），入 bundle 后 macOS 按 CFBundle 赋身份。
- **鉴权（完整版）**：access token 内存；refresh token + user 持久化到 UserDefaults（localStorage 等价物）；启动 hydrate + 拉 `/me` 校验；401 自动 refresh 单飞重放。

> **2026-06-21 重写至功能对齐**：首版只搭了薄壳（强制登录、自造字母头像、弱日期选择器、卡片不显码/不可点开、无关于页/页脚/复制码/倒计时时钟），被指出后**通读 React 参考实现全部 11 页 / 18 组件 / 4 store**，重写为功能对齐版（26 个 Swift 文件）：
> - 恢复**匿名访问**（广场/开启/关于/凭码详情对未登录开放，创建/我的/收藏走门禁回跳）；
> - 头像/技术栈图标**复用后端真实 SVG**（NSImage 渲染 `/static/avatars`、`/static/icons`，含 swift.svg），不再自造；
> - 卡片显示 8 位码 + 整卡点开 + 每秒实时倒计时；详情页**翻页时钟**（`contentTransition(.numericText)`）+ 到期自动开启轮询 + 复制码/分享；
> - **可键盘输入的日期选择器**（`.stepperField` 分段直接打字）+ 图形日历 + 预设；
> - AI 生成/推荐、改资料/改密码、我创建（撤回）/我收藏、关于页（SwiftUI 栈 + 后端栈 from health）、页脚后端在线点 + 技术栈、深/浅主题切换并持久化；
> - 8 位码逐格输入（自动前进/退格回退/整串粘贴）；原生菜单栏「前往/视图」命令（导航/主题/返回 + 快捷键）。

**验收**（2026-06-21，核心旅程 + 连通性）：

- `hello start swiftui` → `swift build` 4.7s、`.app` 组装、原生窗口出现（`status` 显示 `ready` / `native` / pid 存活）；`hello stop swiftui` 干净停。
- `./build`（`swift build`）编译通过，26 个 Swift 文件，无 warning。
- 端到端连通（重写后）：app 启动后 fastapi 日志出现其真实请求 —— `GET /api/v1/health 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/icons/{swift,fastapi,python,postgresql}.svg 200`（技术栈图标渲染）、持久化 refresh token 自动恢复登录态（`GET /api/v1/me/favorites 200`）。
- 待补：XCUITest 原生 E2E（力争对齐 25 smoke），及 `docs/desktop-comparison.md` 对应行。

##### Flutter 落地（2026-06-24）—— 自绘引擎跨端

- **第四种渲染哲学**：electron/tauri 是 Web 壳、swiftui 是系统原生 AppKit，flutter **零 webview、Dart + Skia/Impeller 自绘**——整套 UI 自己画，不调系统控件，一份代码可同时投影桌面与移动（本次先桌面 macOS）。
- **工程形态**：`flutter create` 标准工程（`desktop/flutter`），仅 macOS target；语言 Dart，状态 **Riverpod 2**（NotifierProvider），路由 **go_router**（ShellRoute + redirect 守卫 + `/c/:code` 深链），HTTP `http` 包手写 client（refresh 单飞 + 401 重放，镜像 React），持久化 `shared_preferences`，SVG 用 `flutter_svg`。
- **分层**：`lib/models`（fromJson）/ `lib/api/client.dart` / `lib/stores/{auth,plaza,capsule,theme}.dart`（Riverpod Notifier）/ `lib/theme/{tokens.dart(codegen),app_theme.dart(ThemeExtension),components.dart}` / `lib/widgets` / `lib/pages`（11 页）。
- **令牌 codegen**：`scripts/gen-tokens-flutter` 读 `spec/tokens/tokens.json` → `lib/theme/tokens.dart`（hex→`Color`、渐变→`LinearGradient`、辉光→`Color`+`Blur`、rem→px `double`），`run`/`build.sh` 启动前自动重生成。
- **`./build` 例外为 `build.sh`**：Flutter 强制产物目录 `build/` 与同名脚本文件冲突，故让出 `build` 名（CLAUDE.md 已注明）。
- **两个真问题（落地中修掉）**：① SDK 装法——brew cask 下载 1GB zip 反复 `curl(18)` 半包失败，改 `git clone` 到 `~/development/flutter`（非全局 PATH，`run`/`build.sh` 内部 export）；② **macOS 沙箱默认缺 `com.apple.security.network.client`**，出站 HTTP 被静默拦截、后端零日志，给 `macos/Runner/{DebugProfile,Release}.entitlements` 补权限后连通；另修 `GradientBoxBorder` 在 `AnimatedContainer` 里触发 `BoxBorder.lerp` 抛错（改普通 `Container`）。

**验收**（2026-06-24，编译 + 后端日志，遵循不开 computer-use）：

- `./build.sh`：令牌 codegen + `flutter analyze`（零问题）+ `flutter build macos` 通过；`flutter test` 基础单测 3/3。
- 端到端连通：`hello start flutter` → fastapi 日志 `GET /api/v1/health 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`，佐证 Dart http → `:9080` 全流程；`hello stop` 干净停。
- 待补：`integration_test` 核心旅程（需常驻后端 + 测试驱动），及 `docs/desktop-comparison.md` 对应行。

##### Qt Quick/QML + PySide6 落地（2026-06-25）—— 声明式标记 + 脚本语言逻辑

- **经典范式 + 项目首个 Linux 原生桌面**：视图层用声明式 **QML** 重建，业务逻辑/状态用 **Python**（QObject store 经 context property 暴露给 QML），一套代码跨 Linux/mac/Win。与 flutter 同属「自绘引擎、外观非系统原生」但语言/引擎不同（成熟 C++ 引擎 vs Skia）。
- **工程形态**：依赖经 `uv`（同 fastapi 的 `pyproject.toml` + `uv sync`），装 `PySide6`（6.11.x）。`app/main.py` 起 `QQmlApplicationEngine`、注册 context property。状态经 `worker.py` 的 `QThreadPool` 异步、结果信号回主线程；一次性请求（按码取详情/AI/头像/创建/health/改资料）走 `bridge.py` 的 `ApiBridge`。
- **分层**：`api_client.py`（同步 urllib + refresh 单飞含轮换竞态 + 401 重放）/ `stores/{theme,auth,plaza,capsule}.py`（QObject Property/Signal/Slot）/ `theme/palette.py`（codegen）/ `qml/{Main.qml,fmt.js,components/*,pages/*}`（11 页 + 17 组件）。
- **令牌 codegen**：`scripts/gen-tokens-qt` → `app/theme/palette.py`（颜色转 QML 串，rgba/辉光→`#AARRGGBB` alpha 在前；经 `ThemeStore.colors` 暴露，QML `color: Theme.colors.X` 切换即时刷新）。
- **三个真问题（落地中修掉）**：① **必须 `QQuickStyle.setStyle("Basic")`**——macOS 默认原生 Controls 样式不允许自定义 Button 的 `background`/`contentItem`；② **QML 跨文件 id 作用域隔离**——独立 .qml 看不到 Main 的 `win`/`stack`，导航改走根窗口附加属性 `ApplicationWindow.window.go/push`；③ RowLayout 内 `Text` 误用 `anchors.verticalCenter` → 改 `Layout.alignment`。退出期 `Theme=null` 的 teardown 报错无害（先销毁 context property 再销毁 QML item）。

**验收**（2026-06-25，编译 + 后端日志）：

- `./build`：令牌 codegen + `compileall` + 模块导入 + `qmllint`（零 Error 级；Unqualified-access 是注入属性的预期误报）。
- 路由巡航：程序化遍历全部 11 路由，运行期零 QML 错误。
- 端到端连通：`hello start qt-pyside` → fastapi 日志 `GET /api/v1/health 200`、`GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/{icons,avatars}/*.svg 200`，佐证 Python → `:9080` 全流程；`hello stop` 干净停。
- 待补：`pytest-qt` 核心旅程，及 `docs/desktop-comparison.md` 对应行。

#### 移动客户端落地记录

##### React Native（Expo）落地（2026-06-23）—— 首个移动端

- **质变点**：M5.2 桌面波次（electron/tauri Web 壳、swiftui 纯原生桌面）之后的移动端第一棒。与 `frontends/react-ts` 构成「**Web React vs Native React**」对照——同一种 JSX + Hooks + 单向数据流，渲染到 DOM vs 原生组件。
- **工程形态**：Expo SDK 56 + RN 0.85 + React 19 + TypeScript；脚手架 `create-expo-app`（默认模板 `src/app` + `@/*→src/*` 别名，恰好对齐 React 前端的 `@/` 习惯），裁掉 demo 后重建。Expo Router 文件式路由驱动**底部 Tab Bar**（广场/开启/创建/我的，对标 `ui-prototype/mobile.html`）。
- **分层共享，视图分叉**（实证 M5「逻辑/令牌共享」）：`types` 逐字复制；`api/client`（refresh 单飞+401 重放+Envelope 解包）仅把 `BASE` 由 `""`(Vite 代理)改为 `API_BASE`(直连 :9080)；`plaza`/`capsule` zustand store 逐字搬；`auth`/`theme` 把 `localStorage`→`AsyncStorage`（异步 hydrate）；`utils/format` 逐字。**只有视图层（11 屏 + UI 基元/域组件）用 RN 原生组件重建**。
- **设计令牌 codegen**（落地 M5.1 的 JS 目标）：新增 `scripts/gen-tokens-rn`，读 `spec/tokens/tokens.json` 生成 `mobile/react-native/src/theme/tokens.ts`（rem→px、颜色/渐变保留），`theme/index.ts` 包成调色板/glow/字体/间距消费层。`run`/`build` 启动前自动重生成，保证不漂移。RN 这一棒首次把令牌 codegen 管线做实（此前 swiftui 是手抄）。
- **直连不走代理**：RN 无 Vite，`fetch` 直打 `:9080`（`EXPO_PUBLIC_API_BASE` 可覆盖），与 swiftui 同法；头像/技术栈图标用 `react-native-svg` 的 `SvgUri` 拉后端真实 `/static/*.svg`，不自造。
- **`hello` 登记**：新增 `MOBILE` 表（`all_stacks()` 合并 `kind="mobile"`）：`react-native`(7192，接 7190–7199 段)。`./run` 起 Metro dev server（`CI=1 expo start --port 7192`），沿用「探端口即就绪」模型；在模拟器打开是独立动作（`./run ios`）。
- **辉光取舍**：CSS 多层 box-shadow 辉光在 RN 无对应，用 iOS `shadow*` + `expo-linear-gradient` 近似，Android 退化为 `elevation`；视觉求神似。

**验收**（2026-06-23，构建/打包/编排绿；设备级 E2E 待运行时）：

- `./build` 全绿：令牌 codegen + `tsc --noEmit`（0 error）+ `expo export --platform ios`（Metro 完整打包，entry 4MB），验证全 30+ 文件的导入/转译/解析。
- 编排：`hello start react-native` → Metro 在 :7192 `ready`（`packager-status:running`、codegen 自动执行、后端指向 :9080）→ `hello stop react-native` 干净停、端口释放。
- 核心旅程 E2E：Maestro flow `.maestro/core-journey.yaml`（注册→建胶囊→看详情→收藏→我的列表）+ 关键元素 `testID` 已就绪。
- **待补（环境阻塞）**：iOS 模拟器运行时（`xcodebuild -downloadPlatform iOS`，~7GB）在本次非交互沙箱中未能推进，需在交互式 Xcode/终端中安装；Maestro CLI 待装。二者就绪后即可跑核心旅程 + simctl 截图 + 后端日志连通性佐证（与 swiftui 同法）。

##### iOS 原生（SwiftUI）落地（2026-06-29）—— 与 macOS 端共享逻辑

- **「macOS SwiftUI vs iOS SwiftUI」对照**：与 `desktop/swiftui` 同语言同框架,**逻辑层(Models/DateUtil/APIClient/AppStore/Tokens/Components)拷贝改写**、视图层按移动 IA 重建——底部 Tab Bar(广场/开启/创建/我的)+ 各 Tab `NavigationStack` 替代桌面顶部导航 + Route 栈。
- **工程形态**：iOS app 不能纯 SwiftPM 在模拟器跑 → **XcodeGen**(`project.yml` → `.xcodeproj`,提交 yml、gitignore xcodeproj)。依赖 **SVGView**(SwiftPM) 渲染后端 SVG 头像/图标——iOS 的 `UIImage` 不像 macOS `NSImage` 那样原生认 SVG。
- **逻辑层共享**：`APIClient` 仅改 `resolveBaseURL`(模拟器不继承宿主环境变量,改读 Info.plist `APIBase`,由 `HT_API_BASE` 构建设置注入);`AppStore` 复用鉴权/主题/持久化,导航换 Tab + 登录 sheet;`Tokens` 手抄 `NSColor`→`UIColor` 动态色;`Components` 零改。
- **iOS 平台坑（已解决）**：① **ATS 默认拦明文 HTTP** → Info.plist 开本地网络例外（iOS 版「沙箱拦网」,否则后端零日志）;② UIImage 不认 SVG → SVGView;③ 自定义 DerivedData 路径 → `run` 用 `xcodebuild -showBuildSettings` 动态取 `TARGET_BUILD_DIR`;④ 视图适配:`NSPasteboard`→`UIPasteboard`、自定义日期选择器→iOS 原生 `DatePicker`、8 位码逐格改隐藏 TextField + 8 格显示（软键盘退格天然可用）。
- **`hello` 登记**：`MOBILE` 表 `ios`(`port: None` → status `native`),`run` 编译+`simctl` 装+前台 `launch --console-pty`,据 run 进程存活判就绪（同 swiftui 桌面端）。**环境利好**:iOS 模拟器运行时 26.3 已装,故 iOS 可真·编译+启模拟器+跑+后端日志验证（react-native 当时被卡的就是这个运行时）。

**验收**（2026-06-29，编译 + 模拟器 + 后端日志，遵循不开 computer-use）：

- `./build`：xcodegen + xcodebuild（iphonesimulator）编译通过（11 屏 + 组件全绿）。
- 端到端：`hello start ios` → 编译 → 启模拟器 → 装 → 启动(status `ready`/`native`)；fastapi 日志出现 `GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`（SVGView 渲染真实头像、分段筛选生效）；`hello stop` 干净停。
- 待补：XCUITest 核心旅程,及 `docs/desktop-comparison.md` / 移动对比对应行。

##### Flutter 移动端落地（2026-07-01）—— 一码多端

- **同源工程,不复制**：与 `desktop/flutter` 是**同一份 `lib/`**（物理工程唯一在 `desktop/flutter`；`mobile/flutter` 只提供移动运行入口 `run`/`build` + 文档,`./run` = `flutter run -d iOS 模拟器`,cd 到同源工程执行）。`hello` 里 `flutter`(desktop,`-d macos`) 与 `flutter-mobile`(mobile,`-d ios`) 是同一工程的两个运行目标。
- **一批页面,两套 IA,桌面零回归**：**go_router 路由树完全没动**,移动 IA 全部由外壳层的 `MediaQuery` 宽窄分支实现——`kWideBreakpoint=740`,`MainLayout`/`MeLayout` 窄屏走新增的 `MobileShell`(精简顶部 bar + 底部 `NavigationBar` 广场/开启/创建/我的,`context.go` 切路由,受保护 tab 复用既有 redirect 守卫);宽屏保持顶部 nav + Footer 现状。页面级响应式:`CapsuleGrid` 本就 `LayoutBuilder`(窄屏单列)、hero 窄屏缩字号/紫光防溢出、`PlazaToolbar` 窄屏竖排全宽搜索、`Container2` 窄屏收紧边距(一处惠及所有页)。
- **加平台**：`flutter create --platforms=ios,android --org pro.hellotime .` 只补 `ios/`/`android/` 脚手架,不动 `lib/`(bundle 与 macOS 一致 `pro.hellotime.hellotimeFlutter`)。iOS 加 ATS 本地明文例外(否则 Dart http 到 `:9080` 被拦、后端零日志)。`flutter_svg` 遇 `<filter>` 打印 `unhandled element` 警告,良性。
- **平台状态**：iOS ✅ 已验证;Android 脚手架已就位但**本机无 Android SDK**,`flutter build apk` 待 SDK(代码层无额外工作,同一 `lib/`)。

**验收**（2026-07-01，编译 + 模拟器 + 后端日志，遵循不开 computer-use）：

- `mobile/flutter/build`：令牌 codegen + `flutter analyze`(0 issue) + `flutter build ios --simulator` 通过。
- 端到端：`hello start flutter-mobile` → `flutter run -d "iPhone 17 Pro Max"` 编译+启动(Dart VM Service ready);fastapi 日志出现 `GET /api/v1/plaza/capsules?...&pageSize=15 200`、`GET /static/avatars/*.svg 200`、`GET /api/v1/health 200`,佐证 Dart http → `:9080` 全链路;`hello stop` 干净停。
- 待补：`integration_test` 核心旅程、Android SDK 后 apk 构建、`docs/mobile-comparison.md` 已补对应行。

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
| WinUI 3 仅 Windows 阻挡自动化（M5） | 中 | 在自有 Windows 机上构建验证；排 M5 最后 |
| 原生端验证工具链碎片化（M5） | 高 | 不强求 25 条平移；定义 ~6 条核心旅程子集，按平台选 XCUITest/Maestro/automator；性价比低者人工 + 截图留证 |
| 各端令牌与 `tokens.json` 漂移（M5） | 中 | codegen 统一生成 + `verify-design-tokens` 扩展拦截 |
| 桌面/移动布局强行共享导致两头不讨好（M5） | 中 | 分层共享：仅契约/令牌/逻辑共享，布局按 Web 桌面原型 vs `mobile.html` 各自对标 |

## 7. 估算与节奏

| 阶段 | 估算 | 累计 |
|---|---|---|
| M0 · 设计基础 | 1.5 周 | 1.5 周 |
| M1 · 参考栈 | 2.5 周 | 4 周 |
| M2 · 第一批（6 实现并行） | 3 周 | 7 周 |
| M3 · 全面扩散（13 实现高度并行） | 5 周 | 12 周 |
| M4 · 打磨发布 | 2 周 | **14 周（≈ 3.5 个月）** |
| M5 · 全端扩散（11 客户端，分三波） | 6 周 | 20 周（≈ 5 个月） |

**分阶段发布标签**

| 标签 | 条件 |
|---|---|
| `v0.1` | M0：设计稿 + 工具链 |
| `v0.2` | M1：FastAPI + React 可跑 |
| `v0.5` | M2：第一批 6 实现全绿 |
| `v0.9` | M3：全部 20 实现全绿 |
| `v1.0` | M4：文档 + 打磨完成 |
| `v1.1` | M5.2：Web 背书桌面/移动客户端全绿（electron · tauri · react-native · flutter） |
| `v1.2` | M5.3：纯原生客户端全绿（ios · android · swiftui · qt-pyside · wechat · winui3），31 实现就位 |

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
| M5 桌面/移动端归属？ | 新增 `desktop/`（6）`mobile/`（5）两大类目，共 11 实现，纯 API 消费者复用既有后端 |
| Linux 原生桌面怎么覆盖？ | 原 5 桌面中 swiftui=mac、winui3=win、electron/tauri=Web 壳，Linux 原生仅 Flutter；新增 `desktop/qt-pyside`（Qt Quick/QML + PySide6）作第二个 Linux 可跑原生桌面，桌面增至 6 |
| Qt/PySide 与 Flutter 重复吗？ | 不重复，差异化保留：同为「自绘引擎跨端、外观非系统原生」，但 Qt=C++ 引擎 + Python(PySide6) + QML 声明式、Flutter=Dart + Skia/Impeller 桌面移动单工程；Qt 还呼应 `backends/fastapi` 的 Python |
| 桌面与移动 UI 共享代码？ | 分层共享：契约/令牌/逻辑共享，布局/导航不共享；移动端对标 `ui-prototype/mobile.html` |
| Flutter 桌面 + 移动两份代码？ | 否，单工程双类目，`LayoutBuilder` 按断点分叉布局 |
| Electron 与 Tauri 是否重复？ | 不重复，两者都留并差异化：内嵌不同前端（React vs Svelte/Solid）+ 各做一次原生桥（Node IPC vs Rust command），对比「自带引擎/JS 壳 vs 系统 WebView/Rust 壳」 |
| WinUI 3 Windows 环境？ | 用自有 Windows 机构建验证，排 M5 最后 |
| 微信小程序 AppID？ | 本地调试用「测试号」即可；真机扫码才注册个人免费 AppID |
