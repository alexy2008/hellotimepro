# HelloTime Pro

> 封存此刻的心意，在未来的某个时刻再打开 — 现在有了用户、广场与收藏。

HelloTime Pro 是一个**多技术栈对比学习项目**。围绕同一个业务场景（时间胶囊 + 用户体系 + 胶囊广场），横向展示：

- **10 个后端**：Spring Boot · FastAPI · Gin · Elysia · NestJS · ASP.NET Core · Vapor · Axum · Drogon · Ktor
- **5 个前端**：Vue 3 · React · Angular · Svelte · Solid
- **5 套全栈**：Next.js · Nuxt · Spring MVC · Laravel · Rails

所有实现共享同一份 API 契约、同一套设计令牌、同一套验证脚本，但**内部**使用各自技术栈的地道写法（Signals / 组合式 / Hooks / Runes / ...），让读者可以在一个仓库里高密度对比差异。

> 本项目专为**教学 / 对比 / 研究**，不面向生产。

## 快速理解（3 分钟）

- 这不是一个应用，而是**一组等价实现**。从任何一个入手都可以完整跑起来。
- 规范在 `spec/` 下。**代码只是规范的投影**；有歧义先改 spec 再改代码。
- 每个实现自带 `./run` / `./build` / `./test` 三个脚本。脚本只支持 **macOS / Linux**。
- 默认数据库是 **PostgreSQL**；所有实现也支持 **SQLite**，通过 `DB_DRIVER` 环境变量切换。
- 10 个后端都遵循 `:29xxx` 端口段，前端通过 `:9080` 代理统一访问当前选中后端。
- 5 个全栈各自独立运行（`:7177..7182`），不走代理。

## 我是新读者，从哪儿开始

按顺序读：

1. [`docs/01-requirements.md`](docs/01-requirements.md) — 这个项目做什么 / 不做什么
2. [`docs/02-design.md`](docs/02-design.md) — 架构、数据模型、API、鉴权、前端 / 后端如何组织
3. [`docs/03-roadmap.md`](docs/03-roadmap.md) — 现在进行到哪里，接下来做什么

看完 3 份文档，你就能：

- 解释每个实现必须满足的行为
- 评估某次改动应该落到 spec 还是落到实现
- 选一个栈动手贡献

## 本地跑起来（一条黄金路径）

**前置**

- macOS / Linux
- Docker（起 Postgres）
- Node.js 20+（先跑参考栈够用）

**步骤**

```bash
# 1. 克隆
git clone <repo>
cd HelloTimePro

# 2. 起本地 Postgres（端口 55432，数据存 ./data/pg）
docker compose up -d postgres

# 3. 启动参考栈：FastAPI (:29010) + React (:7174)
./scripts/hello start fastapi
./scripts/hello start react-ts

# 4. 切换代理并打开
./scripts/hello switch fastapi     # :9080 → fastapi
open http://localhost:7174         # React 前端
```

> 参考栈选定为 **FastAPI（后端）+ React（前端）**。原因见 [`docs/03-roadmap.md §2`](docs/03-roadmap.md#2-参考栈)。

## 仓库结构一览

```
HelloTimePro/
├── spec/              # 单一事实源（OpenAPI / tokens / schema / avatars）
├── backends/          # 10 个后端实现
├── frontends/         # 5 个前端实现
├── fullstacks/        # 5 套全栈实现
├── verification/      # 契约验证 + UI 冒烟脚本
├── scripts/           # hello CLI + dev-manager Web UI + docker-compose
├── docs/              # 设计与规划文档（本 README 的家）
└── ui-prototype/      # 设计原型（纯 HTML / CSS）
```

## 端口速查

| 组别 | 端口 |
|---|---|
| 后端 | `:29000`（Spring Boot） `:29010`（FastAPI） `:29020`（Gin） `:29030`（Elysia） `:29040`（NestJS） `:29050`（ASP.NET） `:29060`（Vapor） `:29070`（Axum） `:29080`（Drogon） `:29090`（Ktor） |
| SPA → 后端代理 | `:9080` |
| 前端 | `:7173`（Vue） `:7174`（React） `:7175`（Angular） `:7176`（Svelte） `:7180`（Solid） |
| 全栈 | `:7177`（Next） `:7178`（Nuxt） `:7179`（Spring MVC） `:7181`（Rails） `:7182`（Laravel） |
| 开发面板 | `:9090`（dev-manager Web UI） |
| Postgres | `:55432` |

完整分配与选择理由见 [`docs/02-design.md §4`](docs/02-design.md#4-端口分配)。

## 与老版本的关系

HelloTime Pro 是 [HelloTimeByClaude](https://github.com/<owner>/HelloTimeByClaude) 的**破坏式升级**：

- 新增：用户账号、胶囊广场、收藏、"我的"空间
- 删除：管理员模块、桌面 / 移动端、Windows 原生脚本支持
- 替换：SQLite 单驱动 → PG/SQLite 双驱动；硬编码配色 → 语义化设计令牌

两个仓库可以同时运行（端口不冲突），数据库彼此隔离。详细差异见 [`docs/01-requirements.md §2`](docs/01-requirements.md#2-本次升级的核心变化对老版本读者)。

## 如何贡献

1. 阅读 `docs/01-03`
2. 挑一个 M2 / M3 / M4 的实现（见 Roadmap）
3. 开 `feature/<stack>-<feature>` 分支
4. 本地跑 `verify-contract.sh <stack>`（后端 / 全栈）或 `verify-ui-smoke.sh <stack>`（前端）
5. PR 附上验证脚本输出

对 spec 的变更必须走独立 PR，不夹带到实现变更里。

## 当前状态

本仓库目前处于 **M0 · 设计与基础设施** 阶段：文档先行，实现尚未开始。

下一步：选定参考栈并打通 M1（见 [`docs/03-roadmap.md`](docs/03-roadmap.md)）。

## 许可

MIT
