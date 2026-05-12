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

#### 后端（8 个，建议推进顺序）

1. **Elysia**（Bun + TS，与 NestJS 风格近，TypeScript 开发者顺手）
2. **NestJS**（分层与 FastAPI / Spring Boot 对应，TS 社区标准企业框架）
3. **Ktor**（Kotlin + Exposed / JPA；有 Spring Boot 作参照后更顺）
4. **ASP.NET Core**（C# + EF Core；文档完备，写法独特值得一看）
5. **Axum**（Rust + sqlx；类型安全极致，适合展示所有权模型）
6. **Vapor**（Swift + Fluent；仅 macOS，排后是因为受限而不是难）
7. **Drogon**（C++20 + CMake；v1 工具链已趟通，排最后因编译循环慢）

#### 前端（2 个）

| 实现 | 要点 |
|---|---|
| `frontends/svelte-ts/` | Svelte 5 runes（`$state / $derived / $effect`）+ `svelte-routing` |
| `frontends/solid-ts/` | SolidJS `createSignal / createResource`；细粒度响应式与 React 的心智对比 |

#### 全栈（3 个）

| 实现 | 要点 |
|---|---|
| `fullstacks/rails/` | ERB + Turbo + Hotwire；Rails 约定优于配置的全栈典范 |
| `fullstacks/laravel/` | Blade + Alpine.js；PHP 现代全栈的最佳代表 |
| `fullstacks/spring-boot-mvc/` | Thymeleaf + HTMX；Java 系服务端渲染，与前后端分离形成强对比 |

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
