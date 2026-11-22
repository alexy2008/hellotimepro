# 2.0 升级指南（每个实现的升级任务都从这里开始）

> 面向所有编码 agent（Codex、OpenCode、Antigravity / Gemini、Claude Code…）。通用工作约定见根目录 `AGENTS.md`，本文件只讲 2.0 升级本身。

> 适用范围：全部 10 个后端、5 个前端、5 个全栈（进度见第 5 节）。桌面端 / 移动端不在本轮。
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
10. 空值字段（`message`、`errorCode`、`favoritedAt`、`content`、`farthestOpenAt`…）照 openapi 返回 `null`，不要省略字段。序列化器默认跳过空值的要关掉或绕开（如 Swift Codable 的 `encodeIfPresent`、Go 的 `omitempty`）。
11. 单元测试同步：统计、收藏口径、删除连带、日历年上限、字面匹配。删除连带的回归测试要**关闭 SQLite 外键**再跑，证明不依赖级联（aspnet、axum、vapor、drogon 都这样做）。
12. **路径里的胶囊 id 也要校验 UUID 格式**：`GET /plaza/capsules/{id}`、`DELETE /me/capsules/{id}`、`DELETE /me/favorites/{capsuleId}` 格式不合法 → 422 `VALIDATION_ERROR`（与 fastapi 的 `uuid.UUID` 路径参数一致）；格式合法但不存在 → 404（取消收藏仍幂等 204）。不要让解析异常落到通用处理器变成 500，也不要吞掉变成 204。Java 的 `UUID.fromString` 过于宽松（`1-1-1-1-1` 也能解析），先用正则判格式。契约目前只测了 `POST /me/favorites` 的非法 UUID，这几条要靠单测兜住。

第一批（gin、spring-boot、ktor、nest、elysia）踩到的 SQLite 坑，后面的实现照做即可：

- **种子数据的 UUID 是无连字符的 32 位十六进制**，应用新建的是带连字符的标准格式，同一张表里两种并存。要么像 spring / ktor 那样靠列类型映射统一，要么像 gin / nest / elysia 那样「查找时两种格式都匹配、输出时统一成带连字符」；写外键（收藏、删除）用查到的原始主键。
- **时间是 ISO 文本**：手写 SQL 里和 `open_at` 比较的 `now` 必须按种子的格式绑定（`YYYY-MM-DDTHH:MM:SS[.ffffff]+00:00`）。部分 ORM 在手写条件里不走实体的时间转换器（TypeORM 会绑成空格分隔的格式，同一天内比较出错）。
- **最远 / 最近开启时刻建议用 `ORDER BY open_at … LIMIT 1` 取列**：SQLite 下 `MAX/MIN` 聚合的结果是字符串，丢了列的类型映射（fastapi 用 `_as_utc` 兜底）。
- **先读后写的事务要一开始就拿写锁**：`BEGIN IMMEDIATE`（Go `_txlock=immediate`、sqlite-jdbc `transaction_mode=IMMEDIATE`）或单连接池，否则并发时读锁升级为写锁会 `SQLITE_BUSY`。

第二批（aspnet、axum、vapor、drogon）补充的坑，全栈的接口层同样适用：

- **SQLite 地址恰好去掉 `sqlite:///` 前缀**：验证脚本会把 `DB_URL` 规范成 `sqlite:////绝对路径`，去掉 `sqlite:///` 后正好是 `/绝对路径`。多去或少去一个斜杠，就会变成相对路径或带双前导斜杠的路径（axum、vapor）。
- **日历年加法别让标准库把闰日进位**：C 的 `timegm` / `mktime` 这类会归一化日期的函数，会把非闰年的 2 月 29 日算成 3 月 1 日。要先判断目标年有没有这一天，没有就显式回退到 2 月 28 日（drogon）。
- **`FOR UPDATE` 只锁胶囊行**：加锁查询别连 `users` 表，PostgreSQL 会把 FROM 里所有表的命中行都锁上，连作者行一起锁住。确实要连表时写 `FOR UPDATE OF capsules`（axum）。
- **统计在空集上也要返回 0**：分组聚合遇到空集合时可能一行都不返回，或者返回 `NULL`。`counts` 各项要落成 `0`，最远 / 最近时刻落成 `null`（aspnet）。

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
   - 创建页草稿按账号保存。封存请求的提交锁和成功回执由创建路由持有，切皮肤后继续使用同一份；成功只清空本次提交的草稿版本。登出或换账号时清空草稿。
   - AI 代笔等待响应或逐字填入期间，用户手动改标题、正文、开启时间，立即终止这次代笔对草稿的写入；请求失败时保留原文。
   - 开启时间上限用「10 个日历年」（React `addCalendarYears`），两头各留余量
   - 登录 / 注册 / 资料 / 改密码的**表单值也要跨皮肤保留**（放共享 store；离开页面、成功、登出时清空）
   - 「我的」列表支持 `list-next`。删除或取消收藏后，按仍显示的条数计算下一页，重读发生前移的边界页，按 ID 去重；直到显示条数与服务端总数一致。
   - 详情页倒数归零后**以服务端 `isOpened` 为准**，未确认时退避重试（1s、2s…≤5s）。从动画开始就监听取消信号，换码、换肤或离页后，旧视图停止轮询和通知。初次加载遇到 404 显示查无此码，其他失败提供重试。
   - 首页和开启页都按路由保存 8 格输码。切皮肤保留已填内容；改码或离页后，旧查询及延迟跳转失效。
   - 注册和资料页按 Unicode 码点校验昵称（字母、数字、下划线、连字符，2–20 位）。格式错误显示 `invalid`，服务端明确返回昵称冲突才显示 `taken`。
   - 广场新查询失败时显示本次错误和重试入口，旧查询的卡片不得作为新查询结果显示。
   - 匿名点击**任何**「创建」入口（首页、导航、底栏、空状态）和收藏：先弹 `confirm-dialog`，确认后去 `/login?redirect=…`
   - 登录态在首次渲染前恢复（守卫第一帧就能拿到）；后台标签页里定时器驱动的长按不能卡住（不要依赖 rAF）
7. **svelte、solid 升级时补充的坑**（全栈的页面层同样适用）：
   - **首帧守卫跳转要确认页面真的切过去了**：直接打开 `/create`、`/me`，或已登录时打开 `/login`，如果路由器还没开始监听 history 就调用 `navigate()`，只有地址栏变了，页面仍停在原处。冒烟只断言 URL，测不出这个问题。Svelte 的做法是先 `await tick()` 再跳转。
   - **琥珀输码框：一次输入事件带进完整 8 位码时，从头填入**。粘贴、自动填充和 Playwright 的 `fill` 都属于这种情况，可以从 `InputEvent.data` 判断，不要接在已有字符后面。不要指望自动聚焦先完成：Chrome 对没有焦点的输入框调用 `select()` 不生效，换皮肤后马上整码填入就会把新码接在旧码后面（冒烟「开启页换肤保留半截胶囊码」）。
   - **`/me` 请求单飞**：启动时的登录态校验与守卫或资料刷新会同时请求 `/me`，`refreshMe()` 共用进行中的请求。登出或换账号后，旧会话的响应不得写入用户信息。
   - **广场搜索的输入值和防抖计时器放在共享 store**，输入后 300ms 内切皮肤也不丢字（vue、solid）。
   - **挂载时会先执行一次的副作用要跳过初值**：Svelte 的 `$effect`、Solid 的 `createEffect` 都是这样。「出错次数加一就抖动」「校验失败就滚到出错字段」如果不跳过初值，换皮肤后新视图一挂载就会抖动、滚动。
   - 标题、正文、广场搜索都按 Unicode 码点计数和限长（React 用 `Array.from(s).length`），与昵称校验同一口径。
8. **琥珀开启时间改用「星轨时钟」（2026-11-22 定稿，各实现待跟进）**：琥珀创建页不再用原生 `datetime-local`（它的弹出面板由浏览器绘制，皮肤令牌管不到）。结构、类名与交互以原型 `2.0版原型byClaude-合集/assets/js/amber/datetime.js` 为准，样式在 `spec/styles/amber/components.css`「开启时间选择器」一节。时笺的标尺 + 日历不变，预设按钮也不变。
   - 触发条是一个 `<button>`，和输入框等宽，显示日期、星期、时刻和相对时间。`data-testid="create-openat"` 与 `data-value`（ISO）挂在它上面。点开后面板在下方展开，不是浮层，所以不会被卡片裁掉。
   - 面板从上到下：十年星轨（点年份跳到那一年，拖动胶囊只换日子、保留时刻）、日历（方向键逐日或逐周，今天到选中日之间画旅程线）加机械表式昼夜表盘（先拖时针，松手后切到分针；分针越过 12 点自动进退一小时；3 点位是日历窗）、精确倒计时。
   - 面板里的每次改动都夹在开启时间上下限之内，贴到边界时底栏提示。预设、AI 代笔、草稿恢复从外部改时间时只刷新显示，不触发回调。
   - 表盘指针的角度要累加，不能每次取模，否则从 59 分到 0 分时指针会倒转一整圈。表盘 SVG 的配色全部走 spec 里的类名（`clock__g-*`、`orbit__cap-*` 等），实现代码不写色值。
   - 「就这一刻」、Esc、点到组件和预设之外都收起面板；收起时清理 document 上的监听。
   - 展开时把整块面板滚进视口（原型 `reveal()`）：和展开动画同时平滑滚动，向上滚的距离以触发条不被顶部导航挡住为限，底部避开手机底栏。触发条在屏幕下方时，面板不能落到屏幕外。展开动画结束（面板 `transitionend`，`grid-template-rows`，加约 500ms 定时兜底，二者只执行一次，收起或卸载时清理）后再补滚一次，否则展开那一刻文档还没变长，滚动会被当时的最大滚动距离截断，手机窄屏上面板下半部分要手动滑。
   - **皮肤转场改为「柔光拂过」**（`spec/styles/shell.css`，1.9s），样式自动生效。各实现只需在切换皮肤前给 `<html>` 写 `data-skin-dir`：切到时笺写 `prev`，切到琥珀写 `next`；转场结束后删掉。参考 React `stores/ui.ts` 的 `setSkin`。
9. 文档：重写 `README.md` 与 `TECHNICAL_GUIDE.md`（参考 React 的两份）。

验证（**两套皮肤 × PostgreSQL / SQLite 都要 88/88**；后端用 fastapi）：

```bash
./scripts/hello status          # 确认 :9080 指向 fastapi；不是的话先问用户，不要自己 switch
./verification/scripts/verify-ui-smoke.sh <frontend>
./verification/scripts/verify-design-tokens.sh <frontend>
# SQLite 轮：让 FastAPI 和冒烟入口使用同一个 DB_DRIVER=sqlite 和 DB_URL；结束后恢复原后端配置
# hello status 显示的 DB_DRIVER 是保存的默认值，实际驱动以 /api/v1/health 返回的技术栈为准
```

## 3. 全栈清单

全栈 = 第 1 节 + 第 2 节：`/api/v1/*` 跑契约 117/117（双库），页面跑 UI 冒烟 88/88（双库）与令牌检查。服务端渲染 / MPA 的实现照样要满足 X5（切皮肤保留表单与筛选）与 X7。样式若把 `spec/styles` 复制进静态目录，必须是原样拷贝（令牌检查会识别并跳过）。

## 4. 多个 agent 并行时的规矩（重要）

几个 agent 可能同时在**同一个工作目录、同一个 `main` 分支**上工作，共用同一个 PostgreSQL、同一个 `:9080` 反代和同一个 fastapi。

- **契约测试会重置数据库**：`verify-contract.sh` 会先对 `DB_URL`（没设时用 `data/.hello-state.json` 的库）执行 `db reset --seed`。后端任务**必须用独立的库**，不要碰默认库：
  ```bash
  DB_URL=postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_<backend> ./verification/scripts/verify-contract.sh <backend>
  DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-contract-<backend>.db ./verification/scripts/verify-contract.sh <backend>
  ```
  用户名密码从 `data/.hello-state.json` 读，不要写进文档或提交；库要先建好（如 `createdb hellotime_contract_gin`），每个后端各用一个，互不干扰。
- 契约脚本在 reset、服务启动、账号清理、补种期间共用同一 `DB_URL`。SQLite 相对路径以仓库根目录解析。SPA 冒烟从代理的 `/api/v1/health` 核对驱动；健康接口只公布驱动，后端若使用自定义文件或 PostgreSQL 库，启动后端与运行冒烟时都要传同一 `DB_URL`。全栈冒烟默认按自身实现名派生 SQLite 文件。
- **`:9080` 反代是共享的**：前端任务依赖它指向 fastapi。后端任务**不要** `hello switch`，契约测试直接打后端自己的端口。
- **fastapi 换 SQLite 会影响所有前端任务**：前端任务跑 SQLite 冒烟前先确认没有别的前端任务在跑冒烟，跑完立即用 PostgreSQL 重启 fastapi。
- **只改自己的目录**：`backends/<x>/`、`frontends/<x>/` 或 `fullstacks/<x>/`。`spec/`、`verification/`、`docs/`（包括本文件）、`scripts/`、`AGENTS.md`、`CLAUDE.md`、`GEMINI.md` 一律不改；需要改时停下来问用户。
- **只提交自己的目录**：工作区是共享的，别人暂存的文件可能混进来。用限定路径的提交：
  ```bash
  git add backends/<x>
  git commit -m "<中文提交信息>" -- backends/<x>
  ```
  不要 `git add -A` / `git commit -a`，不要 `git stash`、`git reset`、`git checkout -- .` 这类会动到别人改动的命令；不要 push。
- **结果与新发现写在自己的 README 里**：在该实现的 `README.md` 末尾写「2.0 验证」（契约 / 冒烟 / 令牌的通过数、数据库、日期）和「2.0 迁移笔记」（这次踩到、清单里没写的坑）。下面的进度表和 `CLAUDE.md` 由统筹的人汇总更新。

## 5. 进度（统筹的人维护）

| 类别 | 实现 | 状态 |
|---|---|---|
| 后端 | fastapi | ✅ 117/117 双库（2026-11-20） |
| 后端 | gin · ktor · nest · elysia | ✅ 117/117 双库（2026-11-21）；已静态评审，nest 修了一处错误码 |
| 后端 | spring-boot | ✅ 117/117 双库（2026-11-21）；评审后补了路径 UUID 校验（第 1 节第 12 条），复验 117/117 双库 |
| 后端 | aspnet · axum · vapor · drogon | ✅ 117/117 双库（2026-11-21，README 自报，尚未评审） |
| 前端 | react-ts | 升级时记录 88/88 双库 + 令牌（2026-11-20）；11-21 复核修复后通过类型检查，仅做静态验证 |
| 前端 | vue3-ts · angular | 升级时 README 记录 88/88 双库 + 令牌（2026-11-21）；同日复核修复后通过模板与类型检查，仅做静态验证 |
| 前端 | svelte | 升级时 README 记录 88/88 双库 + 令牌（2026-11-21）；同日复核修复后通过模板与类型检查，仅做静态验证（新增的会话竞态单测尚未运行） |
| 前端 | solid | 升级时 README 记录 88/88 双库 + 令牌（2026-11-21）；同日复核修复后通过类型检查，仅做静态验证 |
| 全栈 | next · nuxt · spring-mvc · rails · laravel | ⬜ |

## 6. 任务提示词模板

任何 agent 都可以直接用；把 `<…>` 换掉即可。提示词只指向仓库里的文件，不依赖某个 agent 的记忆或专有功能。

**后端**（建议一次 1–3 个）：

```text
你在 HelloTime Pro 仓库里工作。先读 AGENTS.md，再读 docs/05-upgrade-2.0.md 的第 0、1、4 节。
任务：把 backends/<gin> 升级到 2.0.0（若有多个，逐个完成）。
做法：先通读参考实现 backends/fastapi（可用 git show 0c60082 与 68d22d0 看 2.0 的改动），把第 1 节清单逐条对齐到本栈的惯用写法，不自由发挥。
验证：本实现的单元测试通过；契约测试用你自己的独立库（第 4 节），PostgreSQL 与 SQLite 都要 117/117。
收尾：在 backends/<gin>/README.md 末尾写「2.0 验证」和「2.0 迁移笔记」，然后只提交 backends/<gin>（git commit -- backends/<gin>），中文提交信息。
限制：只改 backends/<gin>；不要 hello switch，不要动默认数据库，不要 push。spec 有疑问或必须改其他目录时，停下来问我。其余情况不用找我确认，一口气做完。
```

**前端**（一次 1 个，可以分几轮提交）：

```text
你在 HelloTime Pro 仓库里工作。先读 AGENTS.md，再读 docs/05-upgrade-2.0.md 的第 0、2、4 节。
任务：把 frontends/<vue3-ts> 升级到 2.0（两套皮肤「时笺 / 琥珀」× 明暗）。
做法：先通读参考实现 frontends/react-ts（README、TECHNICAL_GUIDE 与全部源码），以及 spec/ui/testids.md、spec/ui/copy.md、spec/styles/README.md、2.0版原型byClaude-合集/；列出功能与交互清单，用 <Vue 3 Composition API + Pinia> 的惯用写法逐项对齐，第 2 节第 6 条的坑必须一次做对。不使用 Tailwind。
后端用已运行的 fastapi（:9080 已指向它，不要 switch）。
验证：两套皮肤的 UI 冒烟在 PostgreSQL 与 SQLite 下都 88/88（SQLite 那轮按第 4 节错开、跑完恢复）；verify-design-tokens.sh <vue3-ts> 通过；./build 与 ./test 通过。
收尾：重写 README.md 与 TECHNICAL_GUIDE.md（参照 React 的两份），README 末尾写「2.0 验证」和「2.0 迁移笔记」；只提交 frontends/<vue3-ts>（git commit -- frontends/<vue3-ts>），中文提交信息。
限制：只改 frontends/<vue3-ts>；不要 push。spec 或测试有疑问时停下来问我，其余情况不用找我确认。
```

**全栈**：

```text
你在 HelloTime Pro 仓库里工作。先读 AGENTS.md，再读 docs/05-upgrade-2.0.md 全文。
任务：把 fullstacks/<next> 升级到 2.0（第 3 节）：接口对齐 backends/fastapi，页面对齐 frontends/react-ts。
验证：契约用独立库，PostgreSQL 与 SQLite 都 117/117；UI 冒烟 88/88（双库）；令牌检查通过。
收尾：更新 README（含「2.0 验证」「2.0 迁移笔记」），只提交 fullstacks/<next>，不要 push。
限制同上：只改自己的目录，有疑问停下来问我。
```

**统筹**（每完成一批后，让任意一个 agent 汇总）：

```text
先读 AGENTS.md 与 docs/05-upgrade-2.0.md。检查 git log 和各实现 README 里的「2.0 验证」「2.0 迁移笔记」：
1) 更新 docs/05-upgrade-2.0.md 的进度表；2) 把值得共享的新坑提炼进第 1 或第 2 节清单；3) 同步 CLAUDE.md 的 Verification Notes 与 AGENTS.md §1 的阶段描述。
不要改任何实现代码。改完把改动摘要给我看，经我同意后再提交。
```
