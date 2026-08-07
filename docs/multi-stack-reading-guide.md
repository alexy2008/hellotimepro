# HelloTime Pro · 多栈阅读导览

> 面向对象：第一次面对这个仓库的读者 —— 31 个实现、十几种语言、几十份文档，不知道从哪儿下嘴。
>
> 这份文档**不解释任何一个框架**。它只回答四个问题：**先读什么、按什么顺序读、每一步读哪几个文件、读到什么程度可以停**。
> 横向差异去 `*-comparison.md`，逐家打分去 `*-review.md`，单栈深读去各实现目录下的 `TECHNICAL_GUIDE.md`，踩坑记录去 [`dev-notes.md`](dev-notes.md)。
> 本文只做**路由**，不复述它们的内容。

---

## 0. 先接受三件事

在读任何一行代码之前，这三个心智模型能省掉大量困惑：

**① 代码是 spec 的投影，不是反过来。**
`spec/` 是单一事实源：[`spec/api/openapi.yaml`](../spec/api/openapi.yaml)（端点与错误码）、[`spec/db/schema.sql`](../spec/db/schema.sql)（数据模型）、[`spec/styles/tokens.css`](../spec/styles/tokens.css)（设计令牌）。任何一个实现里的写法都**没有**定义权。看到两个实现不一致时，正确的问题不是"谁写错了"，而是"契约管不管这件事"——契约不管的地方，允许不一致，那正是对比素材。

**② 这是同一道题的 31 份答卷，不是 31 个功能模块。**
它们功能等价、可互换：任意后端 + 任意前端都能拼起来跑。所以**横着读**（同一个功能在 N 个栈里怎么写）收益远大于**竖着读**（把某一个实现从头读到尾）。唯一值得竖读的是参考栈。

**③ 三层不变量决定了"什么必须一样"。**

| 不变量 | 由谁强制 | 允许的自由度 |
|---|---|---|
| API 行为（端点 / 状态码 / 错误码 / 分页） | 104 条黑盒契约用例 | 内部分层、ORM、语言，全部自由 |
| 视觉令牌（色 / 间距 / 圆角 / 辉光） | `spec/tokens/tokens.json` + 各端 codegen | 组件写法、布局实现自由 |
| 业务语义（胶囊不可编辑、收藏幂等、匿名可浏览） | 契约 + UI 冒烟 25 条 | 交互细节、动效自由 |

**不在这三层里的东西——比如并发姿态——各实现允许不一致**，这是明确的项目决策，理由见 [`03-roadmap.md` M2 已知问题 #3](03-roadmap.md)。

---

## 1. 文档地图：谁回答什么问题

按"你现在想知道什么"选，不必按编号顺序读：

| 想知道 | 去读 |
|---|---|
| 这项目做什么 / 不做什么 | [`01-requirements.md`](01-requirements.md) |
| 架构、数据模型、端口、鉴权策略怎么定的 | [`02-design.md`](02-design.md) |
| 现在做到哪、每个阶段踩了什么坑、历史决策 | [`03-roadmap.md`](03-roadmap.md) |
| 验证体系覆盖了什么 | [`04-verification-coverage.md`](04-verification-coverage.md) |
| **十个后端差在哪** | [`backend-comparison.md`](backend-comparison.md) |
| **五个前端差在哪** | [`frontend-comparison.md`](frontend-comparison.md) |
| **五个全栈差在哪** | [`fullstack-comparison.md`](fullstack-comparison.md) |
| **六个桌面端 / 五个移动端差在哪** | [`desktop-comparison.md`](desktop-comparison.md) · [`mobile-comparison.md`](mobile-comparison.md) |
| 每家各自做得怎么样、扣分扣在哪 | [`backend-review.md`](backend-review.md) · [`frontend-review.md`](frontend-review.md) · [`fullstack-review.md`](fullstack-review.md) |
| 鉴权全流程到底怎么转 | [`auth.md`](auth.md) |
| 表结构与跨库方言映射 | [`db-schema.md`](db-schema.md) |
| 跨栈踩坑合集（LLM / Svelte / Spring 跨库 / 本地 PG） | [`dev-notes.md`](dev-notes.md) |
| 某一个栈的内部构造 | 该实现目录下的 `README.md` + `TECHNICAL_GUIDE.md` |
| 想看图文版、不想读 Markdown | [`learning-guide/index.html`](../learning-guide/index.html)（见 §9） |

---

## 2. 主路线：跑起来 → 竖读一个 → 横读一排

这是推荐给绝大多数读者的三步。**不要跳过第一步**——这个仓库的很多设计（代理切换、双驱动、黑盒验证）在跑起来之前是抽象的。

### 第 1 步 · 让参考栈动起来（约 20 分钟）

```bash
./scripts/hello doctor            # 先看环境缺什么
./scripts/db init                 # 建表（数据库维护独立于实现）
./scripts/hello start fastapi     # 参考后端 :29010
./scripts/hello switch fastapi    # :9080 代理指向它
./scripts/hello start react       # 参考前端 :7174
```

打开 `http://localhost:7174`，走一遍主流程：注册 → 创建一个 5 分钟后开启的公开胶囊 → 回广场看到它 → 登出 → 换个账号收藏它。这条路径就是后面所有阅读的锚。

然后做一件**只有这个项目能做的事**：

```bash
./scripts/hello start gin && ./scripts/hello switch gin
```

前端**不用重启**，刷新页面，你正在用 Go 后端跑同一个 React 前端。这一下就把"契约驱动"从概念变成了肌肉记忆。

### 第 2 步 · 竖读参考栈（约 2–3 小时）

只竖读这两个，其余的都横读：

**后端 · `backends/fastapi/`** —— 按请求流向读，别按目录字母序：

```
app/main.py                 # 应用装配、异常处理器、静态资源
  → app/api/v1/favorites.py # 路由层：只做参数绑定 + 调 service + 包 Envelope
  → app/deps.py             # 依赖注入：get_db / current_user_required
  → app/services/favorite_service.py   # 业务规则都在这
  → app/models/capsule.py   # SQLAlchemy 模型
  → app/db/types.py         # 跨库时间类型（PG 原生 / SQLite 文本）
  → app/core/errors.py      # 错误 → 契约错误码的唯一出口
```

**前端 · `frontends/react-ts/`** —— 同样按数据流向：

```
src/api/client.ts           # 唯一出网口：Envelope 解包 + 401 自动 refresh + 重放
  → src/stores/auth.ts      # 登录态、hydrate、token 存放策略
  → src/stores/plaza.ts     # 列表 / 筛选 / 分页 + 请求序列号防乱序
  → src/components/FavoriteButton.tsx   # 一个有完整状态机的小组件
  → src/pages/PlazaPage.tsx # 页面只做编排
```

读完这两个，你就有了对照系——之后看任何一个栈，都是在问"这件事它怎么换个说法做"。

### 第 3 步 · 横读一排（按兴趣，见 §3）

挑一个横切主题（§5）或一条角色路线（§3），在 3–4 个实现之间来回读**同一个文件位置**。永远不要在这一步把某个实现从头读到尾。

---

## 3. 五条角色路线

每条给出：起点 → 中途站 → 出口。时间是粗估，按"能讲清楚给别人听"的标准算。

### 路线 A · 后端多语言对照（半天–2 天）

> 适合：想看同一道题在 Python / Java / Go / TS / Kotlin / C# / Swift / Rust / C++ 里怎么解。

1. 竖读 `backends/fastapi`（§2 第 2 步）
2. 读 [`backend-comparison.md`](backend-comparison.md) §4–§9（分层、数据访问谱系、双库适配、时间戳、鉴权、事务）
3. 挑 **3 个反差最大**的横读同一组文件：`spring-boot`（重型 ORM + 注解）、`gin`（GORM 但极简）、`axum` 或 `drogon`（手写 SQL + 显式跨库编解码）
4. 出口：能回答"为什么 ORM 越重，跨库适配代码越多，但重复代码越少"

### 路线 B · 前端框架差异（半天–1 天）

> 适合：想看响应式模型的根本分野（VDOM / 细粒度信号 / 编译期）。

1. 竖读 `frontends/react-ts`
2. 读 [`frontend-comparison.md`](frontend-comparison.md) §6（响应式模型）+ §7（同一个 store 的五种写法）+ §10（同一个收藏按钮的五种写法）
3. 横读 `stores/auth.*` 五份：`react-ts/src/stores/auth.ts` · `vue3-ts/src/stores/auth.ts` · `angular/src/app/stores/auth.store.ts` · `svelte/src/stores/auth.svelte.ts` · `solid/src/stores/auth.ts`
4. 出口：能解释为什么 solid 和 react 的 JSX 长得几乎一样，行为模型却完全不同

> 加分项：`frontends/solid` 的 `api/client.ts`、`types/`、`utils/` 是从 react-ts **逐字复制**的。对比这两个目录，能直接看出"哪些代码其实与框架无关"。

### 路线 C · 全栈与服务端渲染（半天）

> 适合：想看 HTML 到底在哪儿生成、以及"一个进程两套接口"怎么做。

1. 读 [`fullstack-comparison.md`](fullstack-comparison.md) §5（双入口架构）+ §6（渲染模型）
2. 横读三种范式：`fullstacks/next`（RSC + API Routes）、`fullstacks/rails`（ERB + Turbo）、`fullstacks/spring-mvc`（Thymeleaf + HTMX）
3. 重点读 spring-mvc 的 cookie ↔ Bearer 桥（[`web/CookieTokenFilter.java`](../fullstacks/spring-mvc/src/main/java/com/hellotimepro/springmvc/web/CookieTokenFilter.java)）——它同时满足浏览器 SSR 和黑盒契约两套鉴权，是全仓最有意思的折中
4. 出口：能说清"为什么全栈实现要同时通过契约验证和 UI 冒烟，而纯前端只需后者"

### 路线 D · 桌面端与移动端（半天–1 天）

> 适合：想看同一套逻辑投影到 11 种客户端形态。前置：先走完路线 B。

1. 读 [`desktop-comparison.md`](desktop-comparison.md) §2（装进窗口 vs 重写 UI）与 [`mobile-comparison.md`](mobile-comparison.md) §2–§3
2. 横读三种范式的 API 客户端（都在做同一件事：Envelope 解包 + refresh 单飞 + 401 重放）：
   - Web 壳：`desktop/electron`、`desktop/tauri` —— **没有自己的客户端**，内嵌 `frontends/react-ts` / `frontends/svelte`
   - 原生：`mobile/android/.../data/ApiClient.kt`（与 react 的 `client.ts` 近 1:1 重写）、`desktop/swiftui/Sources/HelloTimeDesktop/Networking/APIClient.swift`
   - 自绘 / 异体系：`desktop/flutter/lib/api/client.dart`、`mobile/wechat-miniprogram/utils/api.js`（`fetch` → `wx.request`）
3. 出口：能回答"布局为什么不共享、而令牌和逻辑为什么必须共享"

### 路线 E · 规范与验证（2–3 小时）

> 适合：想知道"31 个实现怎么保证不跑偏"，或者准备自己加一个实现。

1. [`spec/api/openapi.yaml`](../spec/api/openapi.yaml) 挑三个端点细读：`POST /auth/refresh`、`GET /plaza/capsules`、`POST /me/favorites`
2. [`04-verification-coverage.md`](04-verification-coverage.md) 全文（104 条契约 + 25 条 UI 冒烟的分布）
3. 读两个用例文件感受黑盒风格：[`verification/contract/favorites-count.spec.ts`](../verification/contract/favorites-count.spec.ts)、[`verification/contract/auth.spec.ts`](../verification/contract/auth.spec.ts)
4. 亲手跑一次双驱动：
   ```bash
   ./verification/scripts/verify-contract.sh fastapi
   DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
   ```
5. 出口：能说清"为什么验证必须是黑盒的"（答案：104 条用例要同时适用于 15 个后端/全栈，任何实现感知的捷径都会让它失去这个能力）

---

## 4. 纵切一次：一次收藏点击的一生

comparison 文档都是横切的。这一节是全仓唯一一条**纵向**路径——从鼠标点击到数据库行，再回到界面。**建议照着点一次、同时开着这些文件读**，读完对整个架构的理解会突然收拢。

以参考栈（React + FastAPI，走 `:9080` 代理）为例，每一跳都是真实文件：

| # | 发生了什么 | 文件 |
|---|---|---|
| 1 | 点击 ♡。先判匿名——**弹登录提示而不是静默失败**（这是契约要求的行为） | [`FavoriteButton.tsx`](../frontends/react-ts/src/components/FavoriteButton.tsx) |
| 2 | 调 `api.favorite(id)` | [`api/client.ts`](../frontends/react-ts/src/api/client.ts) |
| 3 | `request()` 附 Bearer；若 401 → **单飞 refresh + 重放原请求**（并发只刷一次） | 同上 |
| 4 | 请求打到 `/api/v1/me/favorites`，被 Vite 代理转发到 `:9080` | [`vite.config.ts`](../frontends/react-ts/vite.config.ts) |
| 5 | `:9080` 转发到当前 `hello switch` 选中的后端 | [`scripts/hello`](../scripts/hello) |
| 6 | 路由层：绑定 body、取当前用户、调 service、包 `Envelope` | [`api/v1/favorites.py`](../backends/fastapi/app/api/v1/favorites.py) |
| 7 | 业务层：查胶囊（PG 上 `SELECT ... FOR UPDATE`）→ 校验"不能收藏自己的"→ 插 favorites 行 → `favorite_count + 1`（SQL 原子表达式）→ 提交 | [`services/favorite_service.py`](../backends/fastapi/app/services/favorite_service.py) |
| 8 | 落库：`favorites` 复合主键保证幂等；`capsules.favorite_count` 是冗余计数，避免广场排序 JOIN | [`spec/db/schema.sql`](../spec/db/schema.sql) |
| 9 | 回程：`{success, data:{capsuleId, favoriteCount, favoritedAt}}` | [`schemas/common.py`](../backends/fastapi/app/schemas/common.py) |
| 10 | 组件本地 state 更新，同时 `patchPlaza()` 同步广场列表里的那张卡片 | [`stores/plaza.ts`](../frontends/react-ts/src/stores/plaza.ts) |
| 11 | 这条链路的每一环都被黑盒用例钉住 | [`verification/contract/favorites.spec.ts`](../verification/contract/favorites.spec.ts) |

**换个栈重走一遍**，用 §6 的映射表找到对应文件。推荐第二遍走 `gin`（第 6–8 跳变成 `internal/handler/` → `internal/service/favorite.go`），第三遍走 `fullstacks/next`（第 4–5 跳**整个消失**——全栈同源，没有代理）。

三遍走完，"什么是契约、什么是实现细节"就不需要再解释了。

---

## 5. 六个横切主题

每个主题给"读哪几个 + 该看出什么"。挑感兴趣的读，互相独立。

### ① 鉴权：refresh 轮转与家族吊销
- 先读 [`auth.md`](auth.md)（权威叙述版），再读 [`backend-comparison.md`](backend-comparison.md) §9（四个流派）
- 对照：`fastapi/app/services/auth_service.py` · `nest/src/auth/auth.service.ts` · `axum/src/services/auth.rs`
- 看点：token 重用检测为什么要**整族**吊销；access token 为什么只放内存、refresh 才落持久化；这个选择如何在 §4 第 3 跳产生连锁反应（也是桌面壳"导出我的胶囊"被取消的原因）

### ② 跨库方言：一份 schema 喂两种数据库
- 读 [`db-schema.md`](db-schema.md) + [`backend-comparison.md`](backend-comparison.md) §6–§7
- 对照：`spring-boot` 的 `CrossDbUuidJdbcType` / `CrossDbOffsetDateTimeJdbcType`（注解式分流）· `axum` 的 Value/Cell 编解码层（手写 SQL 式）· `fastapi/app/db/types.py`（TypeDecorator 式）
- 看点：PG 用原生 `uuid`/`timestamptz`，SQLite 降级为 TEXT，于是**时间比较变成了字符串比较**——这就是为什么所有栈的 SQLite 写入格式必须与 seed 逐字符一致

### ③ `favorite_count`：冗余计数的一致性
- 入口就是 §4 那条链路的第 7 跳
- 对照：`axum`/`vapor`/`drogon`/`laravel`（`DELETE` 后按 rowcount 递减）vs `next`/`nuxt`（三段非事务，代码里有注释说明）
- 看点：**这里各实现故意不一致**。契约只约束串行正确性，并发不在契约内（决策见 [`03-roadmap.md`](03-roadmap.md) §9）。读的时候关注"每种写法在什么并发下会漂移"，而不是"谁写错了"

### ④ AI 集成：唯一的外部依赖
- 规范在 [`CLAUDE.md`](../CLAUDE.md) 的「LLM 调用日志规范」，坑在 [`dev-notes.md`](dev-notes.md) §3
- 参考实现：`backends/fastapi/app/services/llm_client.py`
- 看点：网关不稳定 → 必须重试；建议端点是**公开**的（创建辅助不该要登录）；推荐端点在 LLM 不可用时返回空数组而不是报错——降级策略也是契约的一部分

### ⑤ 设计令牌：从 CSS 翻译到六种原生体系
- 源头 [`spec/tokens/tokens.json`](../spec/tokens/tokens.json)，六个 codegen 脚本：`scripts/gen-tokens-{rn,flutter,qt,android,winui,miniprogram}`
- 看点：Web 端直接吃 CSS 变量，原生端吃不了——于是有了 codegen。小程序更极端：`<image>` 不认 SVG，连头像都得在构建期预渲染成 PNG（`scripts/gen-avatars-miniprogram`）
- 这是 M5 两个真正的工程增量之一（另一个是验证体系）

### ⑥ 验证体系：黑盒的代价与收益
- 读 [`04-verification-coverage.md`](04-verification-coverage.md) + [`verification/scripts/verify-contract.sh`](../verification/scripts/verify-contract.sh) 的头部注释
- 看点：脚本流程（reset+seed → start → 轮询 health → 跑用例 → 清理 → 回灌 → 必停）为什么要这么啰嗦；原生客户端跑不了 Playwright，退化为"编译 + 后端日志佐证"，这个取舍的代价是什么

---

## 6. 映射表：在任意栈里找到"同一个东西"

横读时最费时间的往往不是理解代码，而是**找到对应文件**。备查：

**后端 · 鉴权服务 / 收藏服务**

| 实现 | 鉴权 | 收藏 |
|---|---|---|
| fastapi | `app/services/auth_service.py` | `app/services/favorite_service.py` |
| spring-boot | `src/main/java/…/service/AuthService.java` | `…/service/FavoriteService.java` |
| gin | `internal/service/auth.go` | `internal/service/favorite.go` |
| elysia | `src/services/auth.ts` | `src/services/favorites.ts` |
| nest | `src/auth/auth.service.ts` | `src/favorites/favorites.service.ts` |
| aspnet | `src/Services/AuthService.cs` | `src/Services/FavoriteService.cs` |
| ktor | `src/main/kotlin/…/service/AuthService.kt` | `…/service/FavoriteService.kt` |
| vapor | `server/Sources/App/Services/AuthService.swift` | `…/Services/FavoriteService.swift` |
| axum | `src/services/auth.rs` | `src/services/favorite.rs` |
| drogon | `src/services.cc`（各 service 以命名空间分区） | 同左（`favorite_service`） |

**前端 · 登录态 store**

`react-ts/src/stores/auth.ts` · `vue3-ts/src/stores/auth.ts` · `angular/src/app/stores/auth.store.ts` · `svelte/src/stores/auth.svelte.ts` · `solid/src/stores/auth.ts`

**全栈 · 鉴权服务**

`next/src/services/auth.ts` · `nuxt/server/services/auth.ts` · `rails/app/services/auth_service.rb` · `laravel/app/Services/AuthService.php` · `spring-mvc/src/main/java/…/service/AuthService.java`

**客户端 · API 客户端**

| 实现 | 位置 |
|---|---|
| electron / tauri | 无——内嵌 `frontends/react-ts` / `frontends/svelte`，复用其 `client.ts` |
| swiftui（桌面） | `Sources/HelloTimeDesktop/Networking/APIClient.swift` |
| ios | `Sources/Networking/APIClient.swift`（与桌面版同源改写） |
| android | `app/src/main/kotlin/pro/hellotime/android/data/ApiClient.kt` |
| flutter（桌面 + 移动） | `desktop/flutter/lib/api/client.dart` —— **同一份工程**，`mobile/flutter` 只是运行入口 |
| qt-pyside | `app/api_client.py` |
| winui3 | `Api/ApiClient.cs` |
| react-native | `src/api/client.ts` |
| wechat | `utils/api.js`（`wx.request` 包成 Promise） |

> 后端连接地址各不相同，这不是笔误：Web 前端走 `:9080` 代理；桌面原生直连 `:9080`；Android 模拟器必须用 `10.0.2.2`（模拟器里的 `127.0.0.1` 是它自己）；小程序模拟器跑在宿主进程内，所以又回到 `127.0.0.1`。

---

## 7. 边读边跑：最小命令集

```bash
./scripts/hello list                  # 31 个实现的登记表（名字 / 类目 / 端口）
./scripts/hello status                # 谁在跑；原生客户端端口列显示 native
./scripts/hello start <name>          # 启动
./scripts/hello switch <backend>      # :9080 指向某后端，前端无需重启
./scripts/hello logs <name>           # 读日志——原生客户端的"连通性证明"就靠它
./scripts/hello stop <name>

./scripts/db status | init | reset --seed | seed --force   # 数据库维护独立于实现

./verification/scripts/verify-contract.sh <backend|fullstack>     # 104 条
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh <...>  # 换驱动再来一遍
./verification/scripts/verify-ui-smoke.sh <frontend|fullstack>    # 25 条
```

两个常用姿势：

- **想验证自己读懂了某段逻辑**：改一行让它故意违反契约，跑一次 `verify-contract.sh`，看它精确报出哪条用例挂了。改回来。
- **想看某个客户端到底通没通**：先 `hello logs fastapi` 记住当前尾部，再启动客户端，看日志新增的 `plaza/capsules`、`avatars` 请求（原生端没有 DevTools，这就是标准手法）。

---

## 8. 什么时候可以停 · 常见误解

**停止条件**（不必读完，本来也读不完）：

- 走完路线 A 或 B 中的一条 + §4 的纵切 + 两个横切主题 ≈ 已经能给别人讲清这个项目在演示什么
- 判断标准是"能不能解释取舍"，不是"看过多少文件"。能说清 gin 为什么比 spring-boot 短一半、代价是什么，比通读十个后端有用得多

**四个常见误解**：

1. **"某个实现的写法就是标准"** —— 不是。只有 `spec/` 是。参考栈只是"第一个写的"，不是"最对的"
2. **"实现之间不一致就是 bug"** —— 契约外的不一致是**特性**。典型是并发姿态（§5 ③）与错误信息文案
3. **"先读完文档再看代码"** —— 反了。先跑起来（§2 第 1 步），文档在有具体问题时才有效
4. **"31 个实现要挨个读"** —— 没人这么读，也不该这么读。挑 3–4 个反差最大的横读，收益是通读的数倍

---

## 9. 与图文版学习资料的关系

[`learning-guide/`](../learning-guide/) 是一套纯静态 HTML 学习站（`open learning-guide/index.html` 即可），4 页总览 + 20 页单栈详解，配内联 SVG 图，素材全部来自 `docs/` 与各栈 `TECHNICAL_GUIDE.md`。

两者分工：

- **本文** = 路线图。回答"按什么顺序读、读哪个文件、读到什么程度"，全部锚定**真实代码路径**，边读边跑
- **learning-guide** = 图文教材。适合通勤/离线，看架构图和 ER 图比读 Markdown 直观；覆盖 20 个 Web 实现（桌面 / 移动 11 个客户端目前只在 `*-comparison.md` 和各自 `TECHNICAL_GUIDE.md` 里）

建议：先用本文的 §2 跑起来并竖读参考栈，需要图的时候翻 learning-guide，需要横向细节的时候翻 comparison。
