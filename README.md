# HelloTime Pro

> 封存此刻的心意，在未来的某个时刻再打开 — 现在有了用户、广场与收藏。

HelloTime Pro 是一个**多技术栈对比学习项目**。围绕同一个业务场景（时间胶囊 + 用户体系 + 胶囊广场），横向展示 **31 个等价实现**：

- **10 个后端**：Spring Boot · FastAPI · Gin · Elysia · NestJS · ASP.NET Core · Vapor · Axum · Drogon · Ktor
- **5 个前端**：Vue 3 · React · Angular · Svelte · Solid
- **5 套全栈**：Next.js · Nuxt · Spring MVC · Laravel · Rails
- **6 个桌面端**：Electron · Tauri · SwiftUI · WinUI 3 · Qt/PySide · Flutter
- **5 个移动端**：React Native · iOS · Android · Flutter · 微信小程序

所有实现共享同一份 API 契约、同一套设计令牌、同一套验证脚本，但**内部**使用各自技术栈的地道写法（Signals / 组合式 / Hooks / Runes / Compose / SwiftUI / ...），让读者可以在一个仓库里高密度对比差异。

> 本项目专为**教学 / 对比 / 研究**，不面向生产。

## 快速理解（3 分钟）

- 这不是一个应用，而是**一组等价实现**。从任何一个入手都可以完整跑起来。
- 规范在 `spec/` 下。**代码只是规范的投影**；有歧义先改 spec 再改代码。
- 每个实现自带 `./run` / `./build` / `./test` 三个脚本（唯一例外：`desktop/flutter` 的构建脚本叫 `build.sh`，因为 Flutter 硬性占用 `build/` 目录名）。脚本只支持 **macOS / Linux**。
- 默认数据库是 **PostgreSQL**；所有实现也支持 **SQLite**，通过 `DB_DRIVER` 环境变量切换。
- 建表 / 灌数据由 `./scripts/db` 统一负责，**后端自己不做任何数据库维护**。
- 10 个后端都遵循 `:29xxx` 端口段，前端通过 `:9080` 代理统一访问当前选中后端。
- 5 个全栈各自独立运行（`:7177..7182`），不走代理。
- 11 个桌面 / 移动客户端是**纯 API 消费者**：复用已绿的后端与 `/api/v1` 契约，不新增任何后端或数据库代码。
- 质量门槛是外部黑盒的：**104 条契约用例** + **25 条 Playwright UI 冒烟**。

## 我是新读者，从哪儿开始

**先读这一份**：[`docs/multi-stack-reading-guide.md`](docs/multi-stack-reading-guide.md) — 多栈阅读导览。面对 31 个实现该按什么顺序读、读哪几个文件、读到什么程度可以停；含五条按角色划分的路线、一条从点击到数据库的纵切链路，以及"同一个东西在各栈叫什么"的文件映射表。

然后按顺序读：

1. [`docs/01-requirements.md`](docs/01-requirements.md) — 这个项目做什么 / 不做什么
2. [`docs/02-design.md`](docs/02-design.md) — 架构、数据模型、API、鉴权、前端 / 后端如何组织
3. [`docs/03-roadmap.md`](docs/03-roadmap.md) — 现在进行到哪里，接下来做什么

看完 3 份文档，你就能：

- 解释每个实现必须满足的行为
- 评估某次改动应该落到 spec 还是落到实现
- 选一个栈动手贡献

想要图文版（架构图 / ER 图 / 鉴权流程，纯静态离线可读）：`open learning-guide/index.html`。

## 本地跑起来（一条黄金路径）

**前置**

- macOS / Linux
- Node.js 20+（跑参考栈够用；其它栈的工具链缺什么，`hello doctor` 会逐项告诉你）
- [`uv`](https://docs.astral.sh/uv/)（`./scripts/db` 与 FastAPI 都依赖它）
- 一个 PostgreSQL：用本机已装的，或用仓库自带的 compose 起一个

**步骤**

```bash
# 1. 克隆
git clone <repo>
cd HelloTimePro

# 2. 准备数据库（二选一）
#    a) 用本机已有的 PostgreSQL：启动 Web UI 填连接信息
./scripts/hello web                # http://127.0.0.1:9090 → 数据库设置
#    b) 或用仓库自带的 compose（映射到 :55432，数据存 ./data/pg）
docker compose up -d postgres

# 3. 体检 + 建表（后端 run 脚本不建表，这一步不能省）
./scripts/hello doctor
./scripts/db init

# 4. 启动参考栈：FastAPI (:29010) + React (:7174)
./scripts/hello start fastapi
./scripts/hello switch fastapi     # :9080 → fastapi
./scripts/hello start react

# 5. 打开
open http://localhost:7174
```

> 连接信息保存在 `data/.hello-state.json`（该目录已 gitignore，不会进仓库）。

**试一下这个仓库的招牌动作**——换后端，前端不重启：

```bash
./scripts/hello start gin && ./scripts/hello switch gin
```

刷新浏览器，你正在用 Go 后端跑同一个 React 前端。

> 参考栈选定为 **FastAPI（后端）+ React（前端）**。原因见 [`docs/03-roadmap.md §2`](docs/03-roadmap.md#2-参考栈)。

## 仓库结构一览

```
HelloTimePro/
├── spec/              # 单一事实源（OpenAPI / tokens / schema / avatars / icons）
├── backends/          # 10 个后端实现
├── frontends/         # 5 个前端实现
├── fullstacks/        # 5 套全栈实现
├── desktop/           # 6 个桌面客户端
├── mobile/            # 5 个移动客户端
├── verification/      # 契约验证 + UI 冒烟脚本
├── scripts/           # hello CLI + db 维护 + 各端令牌 codegen + dev-manager Web UI
├── docs/              # 设计、规划、对比、评审与阅读导览
├── learning-guide/    # 图文版学习资料（纯静态 HTML，离线可读）
└── ui-prototype/      # 设计原型（纯 HTML / CSS，含 mobile.html）
```

## 端口速查

| 组别 | 端口 |
|---|---|
| 后端 | `:29000`（Spring Boot） `:29010`（FastAPI） `:29020`（Gin） `:29030`（Elysia） `:29040`（NestJS） `:29050`（ASP.NET） `:29060`（Vapor） `:29070`（Axum） `:29080`（Drogon） `:29090`（Ktor） |
| SPA → 后端代理 | `:9080` |
| 前端 | `:7173`（Vue） `:7174`（React） `:7175`（Angular） `:7176`（Svelte） `:7180`（Solid） |
| 全栈 | `:7177`（Next） `:7178`（Nuxt） `:7179`（Spring MVC） `:7181`（Rails） `:7182`（Laravel） |
| 桌面 / 移动 | `:7190`（Electron） `:7191`（Tauri） `:7192`（React Native · Metro） |
| 原生客户端 | 不绑端口 —— `hello status` 显示 `native`，以进程存活判就绪，直连 `:9080` |
| 开发面板 | `:9090`（dev-manager Web UI） |
| Postgres | `:55432`（compose 起的那个；用本机 PG 则以你填的为准） |

完整分配与选择理由见 [`docs/02-design.md §4`](docs/02-design.md#4-端口分配)。

## 验证

验证一律是**外部黑盒**的：脚本只通过 HTTP / 浏览器观察，不依赖任何实现内部细节——这样同一套用例才能同时适用于 15 个后端与全栈。

```bash
# 契约：104 条，适用于后端与全栈，两种驱动各跑一次
./verification/scripts/verify-contract.sh fastapi
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi

# UI 冒烟：25 条 Playwright，适用于前端与全栈
./verification/scripts/verify-ui-smoke.sh react
```

覆盖范围逐条说明见 [`docs/04-verification-coverage.md`](docs/04-verification-coverage.md)。原生客户端跑不了 Playwright，改以「编译通过 + 后端日志出现其真实请求」佐证连通性。

## 与老版本的关系

HelloTime Pro 是 [HelloTimeByClaude](https://github.com/<owner>/HelloTimeByClaude) 的**破坏式升级**：

- 新增：用户账号、胶囊广场、收藏、"我的"空间；以及 M5 扩出的 11 个桌面 / 移动客户端
- 删除：管理员模块、Windows 原生脚本支持
- 替换：SQLite 单驱动 → PG/SQLite 双驱动；硬编码配色 → 语义化设计令牌

两个仓库可以同时运行（端口不冲突），数据库彼此隔离。详细差异见 [`docs/01-requirements.md §2`](docs/01-requirements.md#2-本次升级的核心变化对老版本读者)。

## 如何贡献

1. 读 [`docs/multi-stack-reading-guide.md`](docs/multi-stack-reading-guide.md)，再按需读 `docs/01-03`
2. 挑一个实现或一处打磨项（见 [Roadmap](docs/03-roadmap.md) 的 M4 剩余清单）
3. 开 `feature/<stack>-<feature>` 分支
4. 本地跑 `verify-contract.sh <stack>`（后端 / 全栈）或 `verify-ui-smoke.sh <stack>`（前端 / 全栈），双驱动各一次
5. PR 附上验证脚本输出

对 spec 的变更必须走独立 PR，不夹带到实现变更里。单实现的完整验收标准见 [`docs/03-roadmap.md §5`](docs/03-roadmap.md#5-definition-of-done单实现)。

## 当前状态

| 里程碑 | 状态 |
|---|---|
| M0 设计与基础设施 · M1 参考栈 · M2 第一批扩散 | ✅ 已验收 |
| M3 全面扩散（20 个 Web 实现全绿） | ✅ 已验收（2026-06-13） |
| M5 全端扩散（6 桌面 + 5 移动） | ✅ 已验收（2026-07-06） |
| M4 打磨与发布 | 🔄 进行中 |

- 20 个后端 / 全栈实现均通过 **PostgreSQL + SQLite 双驱动契约 104/104**；前端与全栈均通过 **UI 冒烟 25/25**。
- M4 已交付：五份跨栈对比、三份深度评审、鉴权 / 表结构 / README 模板三份规范文档，以及多栈阅读导览。
- M4 剩余：视觉回锅、A11y 审查、广场接口压测、`v1.0.0` 发布标签。

进度细节与历史决策见 [`docs/03-roadmap.md`](docs/03-roadmap.md)。

## 许可

MIT
