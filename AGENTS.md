# AGENTS.md

本仓库给所有编码 agent 的**共用说明**（Codex、OpenCode、Antigravity / Gemini、Claude Code、Qoder 等都以本文件为准）。
`GEMINI.md` 直接引用本文件；`CLAUDE.md` 另含 Claude Code 专用的历史记录，工作约定与本文件一致。

## 1. 项目与当前阶段

**HelloTime Pro** 是多技术栈教学项目：同一个「时间胶囊」Web 应用，用 10 个后端、5 个前端、5 个全栈分别实现，另有桌面端 / 移动端客户端。所有实现共用 `spec/` 里的 API 契约与设计系统。

**当前阶段：2.0.0 升级（破坏性升级，所有实现一并升级，不做中间态兼容）。**
- 已完成：规范（`spec/`）、参考后端 **FastAPI**、参考前端 **React**、契约测试与 UI 冒烟。
- 进行中：其余 9 个后端、4 个前端、5 个全栈。桌面端 / 移动端留到下一轮。
- React、Vue、Angular 已完成前端复核修复。后续实现请对照升级指南第 2 节的换肤、异步请求、分页和错误状态清单。进度表区分升级时的双库冒烟记录与修复后的静态检查。
- **升级任何实现之前，先读 [`docs/05-upgrade-2.0.md`](docs/05-upgrade-2.0.md)**：其中有逐条清单、验证目标、多 agent 并行时的规矩和进度表。

## 2. 工作约定（所有 agent 必须遵守）

- **语言**：与用户交流、提交信息、文档一律用中文（代码标识符照各栈惯例）。
- **规范驱动**：`spec/` 是唯一事实源。实现不得偏离契约；发现 spec 本身有问题时，**先停下来问用户**，同意后先改 spec，再改实现。
- **对齐参考实现，不自由发挥**：动手前先通读参考实现（后端 `backends/fastapi`，前端 `frontends/react-ts`），把功能和交互清单列全，逐项对齐；可以用本栈的惯用写法，但不能少功能、不能自造交互。
- **只改自己负责的目录**：`spec/`、`verification/`、`docs/`、`scripts/` 以及别的实现目录，未经用户同意不改。
- **Git**：直接在 `main` 分支上工作，不建分支、不用 worktree；提交前看 `git status`，只 `git add` 自己负责的目录，并用限定路径提交 `git commit -m "…" -- <目录>`（不要用 `git add -A` / `git commit -a`，不要 `git stash` / `reset` 这类会动到别人改动的命令），不要提交 `.qoder/`、`.opencode/`、原型目录等不相关内容。提交信息用中文，格式参照 `git log`（emoji + 类型 + 中文说明）；署名行按你所用 agent 的惯例。**不要 push**，除非用户要求。
- **数据库**：本机已装 PostgreSQL，连接信息在 `data/.hello-state.json`（也可在 Web UI `:9090` 查看）。**不要探测或启动 Docker。** 不要把密码写进文档或提交。
- **服务启停**：用 `./scripts/hello start|stop <name>`，不要自己在后台起 dev server 后不管。
- **质量取舍**：这是教学项目。以下「生产加固」类问题不作为阻塞项，也不要主动提修复：JWT secret 默认值、错误信息细节、CORS `*`、refresh token 存 localStorage、内存限流在多进程下失效、401 恢复链的边缘情况。专注于各栈惯用写法与契约一致。
- **验证说实话**：只报告真正跑过的结果（通过数 / 总数、数据库、日期）；没跑或失败就照实写。

## 3. 常用命令

```bash
./scripts/hello start|stop|status|logs <name>   # 例如 fastapi、react、gin、vue
./scripts/hello switch <backend>                # 把 :9080 反代指向某个后端（会影响所有前端，见升级指南 §4）
./scripts/hello doctor

./scripts/db status|init                         # 建表（来自 spec/db）
./scripts/db reset --seed                        # 重建并导入演示数据（破坏性）

# 契约（后端 / 全栈）：⚠️ 会先重置并播种 DB_URL 指向的库（否则用 data/.hello-state.json 的库）
./verification/scripts/verify-contract.sh <target>
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <target>

# UI 冒烟（前端 / 全栈）：两套皮肤各跑一遍；SKINS=paper 只跑一套
./verification/scripts/verify-ui-smoke.sh <target>

# 设计令牌（前端 / 全栈）：不带参数只查 spec
./verification/scripts/verify-design-tokens.sh <target>
```

每个实现目录下都有 `./run`、`./build`、`./test`（例外：`desktop/flutter` 的构建脚本叫 `build.sh`）。

**2.0 验证目标**：契约 117/117、UI 冒烟 88/88（44 条 × 两套皮肤）、令牌检查通过，**PostgreSQL 与 SQLite 都要过**。1.x 的 104 / 25 条已作废。

## 4. 架构

```
spec/           唯一事实源
  api/openapi.yaml    API 契约（OpenAPI 3.1，顶部有 2.0.0 变更记录）
  db/schema.sql       参考表结构（2.0 与 1.x 相同）
  styles/             2.0 两套皮肤：base.css + paper/ + amber/ + shell.css
  ui/testids.md       UI 测试钩子与交互约定（X1–X8）
  ui/copy.md          文案
  avatars/v2/         2.0 头像
backends/       10 个后端（:29000–:29090），各自暴露 /api/v1/*
frontends/      5 个 SPA（:7173–:7180），API 走 :9080 反代
fullstacks/     5 个全栈（:7177–:7182），自带 /api/v1/*
verification/   黑盒验证：contract/（node:test）、ui/（Playwright）、scripts/
scripts/        hello 开发管理器、db 维护脚本
docs/           01 需求 · 02 设计 · 03 路线图 · 04 验证覆盖 · 05 2.0 升级指南 · dev-notes 踩坑
2.0版原型byClaude-合集/   2.0 视觉与 DOM 结构基准（直接链接 spec/styles）
```

- **双数据库**：每个后端 / 全栈都要同时支持 PostgreSQL（默认）与 SQLite，用 `DB_DRIVER=postgres|sqlite` 和 `DB_URL` 切换。
- **数据库生命周期在实现之外**：`./scripts/db` 负责建表、重置、导入演示数据；各实现的 `run` 脚本只负责启动，不得建表、迁移或导入数据。
- **数据模型**：`users → capsules → favorites`、`users → refresh_tokens`；`capsules.favorite_count` 是冗余计数，按本栈惯用方式在事务或触发器里维护。
- **认证**：JWT（HS256）+ refresh token 轮换与 family 追踪。
- **后端分层**：表现层 → 应用层 → 领域层 → 基础设施层。
- **样式（2.0）**：两套皮肤 `paper`（时笺）/ `amber`（琥珀）× 明暗，全部来自 `spec/styles`，所有规则都限定在 `:root[data-skin=…]` 下。**不再使用 Tailwind。** 实现自己的样式只能用 `base.css` 刻度与语义层令牌（`--color-*`、`--bg-primary`、`--font-*`、`--radius-*`、`--shadow-card|pop`、`--header-h`），不得写死颜色值。1.x 的 `spec/styles/{palette,tokens,cyber}.css` 只留给尚未升级的实现。
- **验证一律黑盒**：不要为测试加任何「知道实现细节」的捷径；UI 测试只靠 `spec/ui/testids.md` 的钩子定位。

## 5. 端口

| 范围 | 用途 |
|---|---|
| :29000–:29090 | 后端 |
| :7173–:7180 | 前端 |
| :7177–:7182 | 全栈 |
| :9080 | 反代（`hello switch` 切换后端） |
| :9090 | 开发管理 Web UI |

## 6. 其他约定

- 胶囊的内容和开启时间封存后不可修改；用户可以随时删除自己的胶囊（连带删除所有收藏）。
- 不做：找回密码、OAuth、文件上传、评论、邮件通知。

### LLM 调用日志规范

每个后端的 LLM 客户端在三个时机写结构化日志：

| 时机 | 级别 | 必含字段 |
|---|---|---|
| 请求发出前 | INFO | `model=`、`url=` |
| 响应成功 | INFO | `model=`、`elapsed_ms=`、`tokens=`（拿不到写 n/a） |
| 请求失败 | WARNING | `model=`、`elapsed_ms=`、`status=`（HTTP 错误）或 `error=`（网络 / 超时） |

前缀统一为 `LLM request` / `LLM response` / `LLM error`。请求头除 `Authorization` 外必须带 `User-Agent`（默认 `hellotimepro`，经 `LLM_USER_AGENT` 注入）与 `x-opencode-session`（进程内稳定 UUID，`LLM_SESSION_ID` 可覆盖）。参考 `backends/fastapi/app/services/llm_client.py` 的 `_post_json()`，详见 `docs/dev-notes.md §3.4`。

## 7. 延伸阅读

- 跨栈踩坑：`docs/dev-notes.md`
- 需求 / 设计：`docs/01-requirements.md`、`docs/02-design.md`
- 2.0 升级：`docs/05-upgrade-2.0.md`
