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

**目标**：spec 完整、工具链可运行、视觉原型可看。

**交付物**

- [ ] `spec/api/openapi.yaml`：完整路径 + schema + 错误模型
- [ ] `spec/db/schema.sql`：PostgreSQL 方言，单一事实基准
- [ ] `spec/styles/tokens.css` + `spec/tokens/tokens.json`：双向同步
- [ ] `spec/avatars/*.svg` 10 个 + `catalog.json`
- [ ] `spec/icons/` 技术栈 SVG 图标（覆盖所有 20 个实现涉及的技术）
- [ ] `ui-prototype/` 静态 HTML（首页广场 / 登录 / 注册 / 创建胶囊 / 我的 / 关于）
- [ ] `scripts/hello`（`start / stop / status / switch / doctor` 可用）
- [ ] `docker-compose.yml`（Postgres 服务，端口 55432）
- [ ] `docs/` 本套三份文档
- [ ] `verification/contract/*.spec.ts` 用例列表（可不实现，先列齐）

**不做**：任何实际后端 / 前端代码

**通过条件**

- `ui-prototype/` 所有页面可在浏览器打开，视觉确认无大问题
- `docker compose up -d postgres` + `./scripts/hello doctor` 可运行
- 设计原型已经被项目 owner 确认

---

### M1 · 参考栈（2–3 周）

**目标**：FastAPI + React 跑通全部功能，成为后续实现的行为标准。

**交付物**

- [ ] `backends/fastapi/`
  - 完整 `/api/v1/*` 实现
  - Alembic 迁移，schema 与 `spec/db/schema.sql` 100% 对齐
  - PG + SQLite 双驱动通过
  - 单元测试覆盖核心 service
  - `./run` `./build` `./test`
  - README（安装 / 运行 / 切换驱动 / 实现特色）
- [ ] `frontends/react-ts/`
  - 全部 12 条路由实现
  - 所有必要组件（见 `02-design.md §9.4`）
  - Zustand 管理 auth / capsule / plaza store
  - 鉴权全流程（登录 / 登出 / 自动 refresh / 改密）
  - 广场 sort / filter / 分页
  - 收藏（匿名时跳提示）
  - 主题切换持久化
  - `./run` `./build` `./test`
  - README
- [ ] `verification/scripts/verify-contract.sh fastapi` 绿
- [ ] `verification/scripts/verify-ui-smoke.sh react-ts` 绿

**通过条件**

- 新开发者按 README 可在 30 分钟内把 FastAPI + React 跑起来
- 契约验证全绿
- UI 冒烟跑通完整主流程（注册 → 创建公开胶囊 → 登出 → 匿名浏览 → 登录另一用户收藏 → 进"我收藏的"）
- PG 和 SQLite 模式各至少跑通一次

---

### M2 · 第一批扩散（3–4 周，可并行）

**目标**：6 个实现（2 后端 + 2 前端 + 2 全栈）同时推进，以 M1 为基准达到"契约绿"。

#### 后端

| 实现 | 要点 |
|---|---|
| `backends/spring-boot/` | Java 21 + Spring Data JPA + Flyway；分层与 FastAPI 对应关系最清晰，Java 系读者首选参考 |
| `backends/gin/` | Go + GORM + golang-migrate；高并发场景下的极简后端展示 |

#### 前端

| 实现 | 要点 |
|---|---|
| `frontends/vue3-ts/` | Vue 3 + Pinia；组合式 API + composables 的标准写法 |
| `frontends/angular-ts/` | Angular + NgRx Signal Store；Signals + standalone components |

#### 全栈

| 实现 | 要点 |
|---|---|
| `fullstacks/next-ts/` | Next.js 15 App Router + Server Actions + Drizzle + Route Handlers |
| `fullstacks/nuxt-ts/` | Nuxt 3 Nitro + `useAsyncData` + Drizzle + 约定式路由 |

**每个实现的 DoD**（同 §5 Definition of Done）

**并行策略**

- 6 个实现独立分支，互不阻塞
- spec 有歧义时开 spec 专用 PR，不在实现里自决
- 全栈的 `/api/v1/*` 契约与后端共用同一套 `verify-contract.sh`

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
