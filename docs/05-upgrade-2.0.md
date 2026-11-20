# 2.0 升级指南（给每个实现的升级会话）

> 适用范围：其余 9 个后端、4 个前端、5 个全栈。桌面端 / 移动端不在本轮。
> 参考实现已完成：**后端 FastAPI**（`backends/fastapi`）、**前端 React**（`frontends/react-ts`）。
> 原则：`spec/` 是唯一事实源；**先读参考实现再动手，做到功能对齐，不自由发挥**；不做中间态兼容（不需要同时支持 1.x 与 2.0）。

## 0. 先读什么

| 文件 | 用途 |
|---|---|
| `spec/api/openapi.yaml`（顶部「2.0.0 变更」） | 契约：新增接口、规则变化 |
| `docs/01-requirements.md` / `docs/02-design.md` | 业务规则、设计约束（§12 查询、§15 验证） |
| `spec/db/schema.sql` | **表结构与 1.x 相同**，只改了注释（不需要迁移） |
| `spec/ui/testids.md` | 前端 / 全栈：UI 冒烟唯一依赖的测试钩子与 X1–X8 交互约定 |
| `spec/ui/copy.md` | 前端 / 全栈：文案 |
| `spec/styles/README.md` | 前端 / 全栈：两套皮肤的样式与语义令牌 |
| `2.0版原型byClaude-合集/` | 前端 / 全栈：视觉与 DOM 结构基准（直接链接 `spec/styles`） |
| `docs/dev-notes.md` | 跨栈踩坑 |

## 1. 后端清单（对照 `backends/fastapi`）

逐条实现，参考提交：`0c60082`（2.0 主体）、`68d22d0`（评审修正）。

1. **`GET /api/v1/health`**：`version` 固定 `"2.0.0"`。
2. **`GET /api/v1/plaza/stats?q=`**（公开）→ `{ counts: {all, opened, unopened}, farthestOpenAt, nextOpenAt }`
   - `counts` 与广场列表**同一套 where**（只算 `inPlaza = true`，受 `q` 影响），三种 filter 下的 total 必须与列表一致
   - `farthestOpenAt`（最远的开启时刻）/ `nextOpenAt`（未来最近的开启时刻）**不受 `q` 影响**；没有时为 `null`
   - `q` 超过 50 字符 → 422 `VALIDATION_ERROR`
   - 参考：`app/services/plaza_service.py` 的 `plaza_stats`
3. **`GET /api/v1/me/stats`**（需登录）→ `{ created, opened, unopened, inPlaza, favoritesReceived, favoritesGiven }`
   - 含未公开的胶囊；`favoritesReceived` = 我的胶囊被收藏的总次数；`favoritesGiven` = 我收藏了多少
4. **收藏不再校验胶囊状态**：自己的、`inPlaza = false` 的、未开启的都能收藏；`POST /me/favorites` 不再返回 `BAD_REQUEST`（只校验胶囊存在、UUID 合法 → 否则 404 / 422）。`GET /me/favorites` 因此可能含未公开的胶囊。
5. **删除胶囊连带删收藏**：同一事务里**显式**先删收藏再删胶囊（不要依赖外键级联，SQLite 未开 `foreign_keys` 时不生效），`favorite_count` 等统计随之正确。
6. **PostgreSQL 加锁顺序**：删除时先 `SELECT … FOR UPDATE` 锁胶囊行，再删收藏——与收藏 / 取消收藏一致（都是「胶囊 → 收藏」），否则作者删除与他人取消收藏并发会死锁。SQLite 不需要。
7. **`openAt` 上限 = 此刻往后 10 个日历年**（UTC）；目标年没有该日期（2 月 29 日）时取当月最后一天。1.x 多数实现按 3650 天算，**必须改**。下限仍是 > now + 60s。参考 `add_calendar_years`（`app/schemas/capsule.py`）。
8. **`q` 字面匹配**：大小写不敏感子串；用 `LIKE` 时先转义 `\` → `\\`、`%` → `\%`、`_` → `\_`，再加 `ESCAPE '\'`（PostgreSQL 与 SQLite 都要）。标题与作者昵称任一匹配。
9. **头像**改读 `spec/avatars/v2/`（`catalog.json` + svg），不再用根目录的 1.x 头像。
10. 空值字段（`message`、`errorCode`、`favoritedAt`、`content`、`farthestOpenAt`…）照 openapi 返回 `null`，不要省略字段。
11. 单元测试同步：统计、收藏口径、删除连带、日历年上限、字面匹配。

验证（**PostgreSQL 与 SQLite 都要 117/117**）：

```bash
./verification/scripts/verify-contract.sh <backend>
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <backend>
```

## 2. 前端清单（对照 `frontends/react-ts`）

用各自技术栈的惯用写法（Vue Composition API、Angular Signals、Svelte Runes、Solid Signals），**结构对齐 React**：

1. **样式**：只引入 `spec/styles`（base → 时笺三件 → 琥珀三件 → shell），**不再用 Tailwind**（删掉依赖与配置）；自己的样式只用 `base.css` 刻度与语义令牌，不写色值；`verify-design-tokens.sh <name>` 必须通过。时笺字体用 `@fontsource` 自托管。
2. **皮肤 / 明暗**：`<html data-skin data-theme>`，首帧前由 `index.html` 内联脚本从 `localStorage`（`hellotime.skin` / `hellotime.theme`）写好；切换用 View Transition，减少动效时直接切。
3. **逻辑一份，视图按皮肤分**：业务逻辑放在共享层（React 是 `hooks/` + `stores/`），结构差异大的页面在 `skins/paper|amber` 各一份；表单字段、收藏按钮、Toast、确认框只写一份。DOM 结构与类名照原型。
4. **页面与路由**：见 React README 的路由表（`/`、`/open`、`/capsules/:code`、`/create`、`/login`、`/register`、`/me/created|favorites|profile`、`/about`、404）。
5. **测试钩子**：`spec/ui/testids.md` 全部必有钩子与状态属性；X1–X8 约定逐条满足。
6. **评审中修过的坑（必须一次做对）**：
   - 创建页草稿放在内存 store，切皮肤不丢；**登出 / 换账号时清空**
   - AI 代笔：请求成功前不动用户已写的正文，失败时原文保留
   - 开启时间上限用「10 个日历年」（React `addCalendarYears`），两头各留余量
   - 登录 / 注册 / 资料 / 改密码的**表单值也要跨皮肤保留**（放共享 store；离开页面、成功、登出时清空）
   - 「我的」列表分页 + 「加载更多」（钩子 `list-next`），不要只取前 N 枚
   - 详情页倒数归零后**以服务端 `isOpened` 为准**，未确认时退避重试（1s、2s…≤5s），不提前提示「已开启」
   - 匿名点击**任何**「创建」入口（首页、导航、底栏、空状态）和收藏：先弹 `confirm-dialog`，确认后去 `/login?redirect=…`
   - 登录态在首次渲染前恢复（守卫第一帧就能拿到）；后台标签页里定时器驱动的长按不能卡住（不要依赖 rAF）
7. 文档：重写 `README.md` 与 `TECHNICAL_GUIDE.md`（参考 React 的两份）。

验证（**两套皮肤 × PostgreSQL / SQLite 都要 88/88**；后端用 fastapi）：

```bash
./scripts/hello switch fastapi
./verification/scripts/verify-ui-smoke.sh <frontend>
./verification/scripts/verify-design-tokens.sh <frontend>
# SQLite：DB_DRIVER=sqlite 重启 fastapi 后再跑一遍，跑完恢复 PostgreSQL
```

## 3. 全栈清单

全栈 = 第 1 节 + 第 2 节：`/api/v1/*` 跑契约 117/117（双库），页面跑 UI 冒烟 88/88（双库）与令牌检查。服务端渲染 / MPA 的实现照样要满足 X5（切皮肤保留表单与筛选）与 X7。样式若把 `spec/styles` 复制进静态目录，必须是原样拷贝（令牌检查会识别并跳过）。

## 4. 多会话并行时的注意事项（重要）

- **契约测试会重置数据库**：`verify-contract.sh` 先对 `DB_URL`（否则 `data/.hello-state.json`）执行 `db reset --seed`。多个会话同时跑时，**后端会话请用独立的库**：
  ```bash
  DB_URL=postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract ./verification/scripts/verify-contract.sh <backend>
  DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-contract-<backend>.db ./verification/scripts/verify-contract.sh <backend>
  ```
  （用户名密码从 `data/.hello-state.json` 读，不要写进文档或提交；独立的库要先建好，例如 `createdb hellotime_contract`）
- **`:9080` 反代是共享的**：前端会话依赖它指向 fastapi。后端会话**不要** `hello switch`，契约测试直接打后端自己的端口即可。
- **fastapi 换 SQLite 会影响所有前端会话**：前端会话的 SQLite 冒烟请错开跑，跑完立即恢复 PostgreSQL。
- 各会话只改自己目录下的文件；`spec/`、`verification/`、`docs/` 的改动先停下来问。发现 spec 本身有问题时，先改 spec 再改实现。
- 都在 `main` 分支上直接提交（不用 worktree），提交前 `git status` 只加自己目录的文件。

## 5. 进度

| 类别 | 实现 | 状态 |
|---|---|---|
| 后端 | fastapi | ✅ 117/117 双库（2026-11-20） |
| 后端 | nest · elysia · gin · spring-boot · ktor · aspnet · axum · vapor · drogon | ⬜ |
| 前端 | react-ts | ✅ 88/88 双库 + 令牌（2026-11-20） |
| 前端 | vue3-ts · angular · svelte · solid | ⬜ |
| 全栈 | next · nuxt · spring-mvc · rails · laravel | ⬜ |

每完成一个，更新本表、`CLAUDE.md` 的 Verification Notes，并在该实现的 README 里写明验证结果与日期。
