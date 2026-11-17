# HelloTime Pro 需求规格

> 版本 2.0 · 2026-11-17 · 作者 Claude · 面向对象：第一次接触本项目的新开发者
>
> 2.0 是一次整体升级：所有 Web 后端、前端、全栈一并升到 2.0.0，不保留 1.x 的兼容层。变化摘要见 §2.2。

---

## 1. 项目定位

HelloTime Pro 是一个**多技术栈对比学习 / 教学项目**，业务载体是"时间胶囊"（用户写下一段内容，在未来某个时刻才可被打开阅读）。

本项目不是为生产运营设计的产品，而是围绕**同一套 API 契约 + 同一套设计系统 + 同一个业务模型**，让读者能横向对比：

- 10 个后端框架（Spring Boot / FastAPI / Gin / Elysia / NestJS / ASP.NET Core / Vapor / Axum / Drogon / Ktor）
- 5 个前端框架（Vue 3 / React / Angular / Svelte / Solid）
- 5 套全栈方案（Next.js / Nuxt / Spring MVC / Laravel / Rails）

每一个实现都必须是**"该技术栈本地 idiom"**而不是简单平移，但对外表现（API、UI、行为）必须一致。

与 [HelloTimeByClaude](https://github.com/<owner>/HelloTimeByClaude) 的关系：Pro 是一次**破坏式升级**，不做数据迁移、不兼容旧 API、不保留管理员模块。

## 2. 版本变化

### 2.1 Pro 相对老项目 HelloTime

| 维度 | HelloTime | HelloTime Pro |
|---|---|---|
| 用户账号 | 无 | 电子邮件 + 密码，昵称唯一，内置头像 |
| 胶囊归属 | 匿名（仅 `creator` 字符串） | 归属到注册用户（匿名用户无法创建） |
| 首页主体 | 创建 / 开启入口 + 技术栈展示 | **胶囊广场**（列表）+ 创建 / 开启入口 |
| 胶囊可见性 | 靠 8 位码半私密分享 | 二元：`in_plaza` 开关（默认开）+ 8 位码仍可分享 |
| 广场与排序 | 无 | 支持最热（收藏数）/ 最新排序、已开 / 未开过滤 |
| 收藏 | 无 | 登录用户可收藏任意胶囊 |
| 管理员 | 有（管理胶囊） | **移除** |
| 数据库 | SQLite | PostgreSQL 为主，SQLite 可选，环境变量切换 |
| 脚本支持平台 | Unix + Windows PowerShell | **仅 macOS / Linux** |
| 技术栈展示 | 首页显著展示 | 仅在页脚和"关于"页展示 |

### 2.2 2.0 相对 Pro 1.x

| 维度 | 1.x | 2.0 |
|---|---|---|
| 视觉 | 单一 cyber 霓虹主题 × 明暗 | **两套皮肤「时笺」「琥珀」× 明暗**，随时切换（§4.8） |
| 收藏 | 不能收藏自己的、不能收藏 `inPlaza=false` 的 | **任何胶囊都能收藏**，不校验状态（§4.5） |
| 删除 | 「我创建的」里叫「撤回」 | 统一叫**「删除」**；确认框写明后果；连带删除所有收藏（§4.6） |
| 统计 | 无 | 新增 `GET /plaza/stats`、`GET /me/stats`，用于首页概览、筛选计数、「我的」页头（§4.4、§4.6） |
| 首页 | 广场 + 两个 CTA | 增加广场概览与**就地输码开启**（§4.7） |
| 开启页 | 输码 | 登录后另列出「我封存过的胶囊」（§4.3.3） |
| 胶囊详情路由 | `/c/:code`（实现）与文档中的 `/capsules/:code`、`/plaza/:id` 不一致 | 统一为 **`/capsules/:code`**，广场、我创建的、我收藏的都走它（§4.9） |
| 登录回跳 | 各实现自定（路由状态 / 查询参数） | 统一为 **`/login?redirect=<path>`**（§4.1.7） |
| UI 冒烟 | 依赖 `cy-*` 类名与按钮文案 | 依赖 **`data-testid` 测试钩子契约**，每套皮肤各跑一遍（§6） |
| `/health` 的 `version` | `0.1.0` | 固定 `2.0.0` |

## 3. 使用场景与用户角色

### 3.1 角色

| 角色 | 描述 | 能做 | 不能做 |
|---|---|---|---|
| **匿名用户** | 未登录访客 | 浏览广场、排序、过滤、搜索、通过 8 位码开启胶囊、阅读已到期胶囊、切换皮肤与明暗 | 创建胶囊、收藏、查看"我的" |
| **注册用户** | 已登录用户 | 匿名用户的一切 + 创建胶囊 + 收藏 / 取消收藏任意胶囊 + 删除自己创建的胶囊 + 查看"我创建的 / 我收藏的"与个人统计 + 修改密码、昵称、头像 | 修改胶囊内容与开启时间、删除他人胶囊 |

没有管理员角色。

### 3.2 代表性使用旅程

1. **匿名浏览** — 打开首页，看到广场概览与胶囊广场，按"最新"浏览，对某个胶囊感兴趣，点击进入详情（已到期则阅读正文，未到期则看倒计时）；想收藏，被引导登录，登录后回到原处。
2. **注册发胶囊** — 点"注册"，填邮箱 / 密码 / 昵称 / 选头像，注册即登录；进入"创建胶囊"，写内容（没有头绪时可以让 AI 给灵感或代笔）、选开启时间、确认"发布到广场"（默认开启），封存后获得 8 位码可分享。
3. **通过码开启** — 访客从外部拿到 8 位码，直接在首页的输码栏或"开启胶囊"页输入，输满自动查询；已到期则可读，未到期则看到倒计时，倒计时归零时胶囊自动开启。
4. **收藏与回访** — 登录用户收藏一枚未开启的胶囊（别人的、自己的、未公开但持有码的都可以），进入"我的 → 我收藏的"，到期时回来阅读。
5. **换个心情** — 任何用户随时在「时笺」与「琥珀」之间切换，各自还有明暗两色；正在写的草稿、广场的筛选条件不因切换而丢失。

## 4. 功能需求

使用 RFC 2119 关键词：**MUST** = 必须；**SHOULD** = 应该；**MAY** = 可以。

### 4.1 账号与认证

**4.1.1 注册**

- MUST 支持字段：`email`、`password`、`nickname`、`avatarId`
- MUST `email` 符合基础 RFC 5322 格式；**不做邮件验证**
- MUST `email` 全局唯一（大小写不敏感，存储统一小写）
- MUST `password` 长度 ≥ 8，至少包含一个字母和一个数字；服务端用 bcrypt（cost ≥ 10）存哈希
- MUST `nickname` 长度 2–20 字符，允许中英文数字下划线连字符，全局唯一（大小写敏感）
- MUST `avatarId` 必须是服务端内置头像集合中的合法 ID
- MUST 注册成功后自动登录（返回 `accessToken` + `refreshToken`）
- MUST NOT 引入邮箱验证、动态识别码（captcha）、第三方 OAuth
- SHOULD 对相同邮箱 / 昵称的冲突返回 `VALIDATION_ERROR` + 具体 `field`

**4.1.2 登录**

- MUST 以 `email + password` 登录
- MUST 登录失败时不区分"邮箱不存在"与"密码错误"，统一 `UNAUTHORIZED`
- MUST 成功返回 `{ accessToken, refreshToken, user }`

**4.1.3 登出**

- MUST 客户端丢弃 token
- SHOULD 服务端维护 refresh token 黑名单（注销的 refresh token 立即失效）
- MAY 跳过 access token 的服务端状态（短寿即可）

**4.1.4 令牌刷新**

- MUST 支持以 refresh token 换取新的 access token
- MUST refresh token 单次使用（rotate），重放 refresh 触发全家族失效
- MUST 前端在 access token 过期（`401`）时自动刷新并重放原请求；刷新失败才回到登录态

**4.1.5 修改密码**

- MUST 需提供当前密码 + 新密码
- MUST 修改成功后吊销该用户所有已存在的 refresh token（强制其他设备重新登录）

**4.1.6 修改昵称与头像**

- MUST 可修改 `nickname`（唯一性约束同注册）和 `avatarId`
- MUST NOT 支持修改邮箱
- MUST NOT 支持上传自定义头像

**4.1.7 登录引导与回跳**

- MUST 匿名用户访问需登录的页面时，直接跳转 `/login?redirect=<当前路径含查询串>`；点击需登录的操作（创建、收藏）时，先弹确认框提示登录，确认后再跳转
- MUST 登录 / 注册成功后跳回 `redirect`；`redirect` 只接受以单个 `/` 开头的站内路径（拒绝 `//`、`http:` 等），否则回首页
- MUST 已登录用户访问 `/login`、`/register` 时重定向首页
- SHOULD 登录页与注册页之间切换时保留 `redirect`

### 4.2 胶囊创建（登录用户）

- MUST 字段：`title`（1–60 字符）、`content`（1–5000 字符）、`openAt`（ISO 8601 UTC，必须晚于当前时间 + 1 分钟）、`inPlaza`（布尔，默认 `true`）
- MUST 创建者是当前登录用户，不再需要 `creator` 字段
- MUST 服务端生成 8 位 `[A-Z0-9]` 唯一码
- MUST `openAt` 接受的最大范围：当前时间 + 10 年；超出返回 `VALIDATION_ERROR`
- MUST 返回完整胶囊对象（含 `code`）
- MUST 前端校验文案两套皮肤相同，以 `spec/ui/copy.md` 为准（标题为空、正文为空、开启时间过早 / 过晚四条）
- MUST 封存前明确告知：内容与开启时间封存后不可修改；可以在「我创建的」里删除
- MUST 封存成功后展示 8 位码，提供复制码与复制链接（`/capsules/:code`）两个操作
- SHOULD 草稿在本次会话内保留：切换皮肤 / 明暗、离开创建页再回来都不丢；封存成功后清空。MAY 持久化到 `localStorage`
- MAY 提交控件做成"长按封缄"等仪式化交互，但 MUST 可用键盘完成，并满足测试钩子契约对提交控件的约定（见 `spec/ui/testids.md`）

**4.2.1 AI 辅助**

- MUST `POST /api/v1/capsule-suggestion`：按标题生成正文与建议开启天数；标题留空时连标题一起生成
- MUST `GET /api/v1/capsule-recommendations`：返回推荐主题（`count` 3–8，默认 4）；LLM 不可用时返回空数组，前端静默不显示
- SHOULD 创建页在标题为空时展示推荐主题，点击即生成整枚胶囊；提供"换一批"，并防止旧请求覆盖新结果

### 4.3 胶囊查询

**4.3.1 按 8 位码查询（任何用户）**

- MUST 路径：`GET /api/v1/capsules/{code}`
- MUST 未到期 (`openAt > now`)：返回 meta（`code`、`title`、`creator` 摘要、`openAt`、`createdAt`、`inPlaza`），`content = null`
- MUST 已到期：返回完整字段 + `content`
- MUST 不存在：`404 CAPSULE_NOT_FOUND`
- MUST `inPlaza = false` 的胶囊也可通过此路径查询（码即凭证）
- MUST 输入不区分大小写（前端统一转大写），只接受 `[A-Z0-9]`；输满 8 位自动查询
- MUST 详情页（`/capsules/:code`）未到期时展示逐秒倒计时；倒计时归零 MUST 自动重新获取并展示正文，无需手动刷新
- SHOULD 查不到时提示核对易混字符（O 与 0、I 与 1），并说明胶囊也可能已被作者删除

**4.3.2 按胶囊 ID 查询（广场详情）**

- MUST 路径：`GET /api/v1/plaza/capsules/{id}`
- MUST 仅对 `inPlaza = true` 的胶囊可见；`false` 返回 `404`
- MUST 行为与 4.3.1 一致（未到期隐藏 content）
- 说明：2.0 起前端详情页统一按 code 打开（§4.9），此接口保留在契约中，前端 MAY 不使用

**4.3.3 开启页的「我封存过的胶囊」**

- MUST 登录用户在开启页（`/open`）的输码区下方看到自己最近创建的至多 3 枚胶囊（`GET /me/capsules?pageSize=3`），每项显示标题、码、状态（已开启 / 剩余时间），点击进入详情
- MUST 没有创建过胶囊或未登录时不显示该区块

### 4.4 胶囊广场

- MUST 路径：`GET /api/v1/plaza/capsules`
- MUST 仅展示 `inPlaza = true` 的胶囊
- MUST 支持查询参数：
  - `sort`：`hot` | `new`（默认 `new`）
    - `hot` = 按 `favoriteCount` 降序；tie-breaker 用 `createdAt` 降序
    - `new` = 按 `createdAt` 降序
  - `filter`：`all` | `opened` | `unopened`（默认 `all`）
    - `opened` = `openAt <= now`
    - `unopened` = `openAt > now`
  - `q`：可选，模糊搜索关键词；**大小写不敏感**子串匹配
    - 匹配范围：胶囊 `title` **或** 创建者 `nickname`（OR 关系）
    - 前后自动 `trim`；`trim` 后为空视为未传
    - 长度约束：trim 后 1–50 字符；超出返回 `VALIDATION_ERROR`
    - 与 `sort` / `filter` 可叠加（先过滤，再排序、分页）
  - `page`：1-indexed，默认 `1`
  - `pageSize`：默认 `20`，最大 `50`
- MUST 响应每项包含：`id`、`code`、`title`、`creator`（`{ nickname, avatarId }`）、`openAt`、`createdAt`、`favoriteCount`、`isOpened`、`favoritedByMe`（未登录固定 `false`）
- MUST 响应不包含 `content`（列表永不返回正文）
- MUST 响应包含分页信息：`{ page, pageSize, total, totalPages }`
- MUST 卡片点击进入 `/capsules/:code`
- MUST 已开启与未开启的卡片在视觉上明确区分，且不只靠颜色（图标 / 文字 / 形态）
- SHOULD 搜索输入 300ms 防抖；排序、筛选、搜索词在切换皮肤后保留

**4.4.1 广场统计**

- MUST 路径：`GET /api/v1/plaza/stats`，公开，参数 `q`（规则同列表）
- MUST 返回 `counts { all, opened, unopened }`：只统计 `inPlaza = true`；受 `q` 影响，与"切到对应筛选后列表的 `total`"一致
- MUST 返回 `farthestOpenAt`（广场上开启时间最晚的一枚）与 `nextOpenAt`（尚未开启的里最早到来的一枚）；两者不受 `q` 影响，没有对应胶囊时为 `null`
- MUST 前端筛选控件上显示三个数量，随搜索词同步变化
- 说明：「最热」按收藏数排序，作者收藏自己的胶囊也会 +1。这是放开收藏限制后**有意接受**的结果，不做特殊扣除

### 4.5 收藏（登录用户）

- MUST 登录用户可收藏**任何**胶囊，不校验状态：自己创建的、`inPlaza = false` 的、未开启或已开启的都可以
- MUST `POST /api/v1/me/favorites` body `{ capsuleId }`；`DELETE /api/v1/me/favorites/{capsuleId}`
- MUST 胶囊不存在返回 `404`；`capsuleId` 不是合法 UUID 返回 `400 VALIDATION_ERROR`；重复收藏、取消未收藏的胶囊均幂等成功
- MUST 收藏按钮出现在广场卡片与详情页（含未公开胶囊的详情页），显示当前收藏数与是否已收藏
- MUST 匿名用户点击收藏时，先弹出确认框提示登录，确认后跳转登录并携带 `redirect`（§4.1.7）
- SHOULD 乐观更新：点击后立即切换状态，请求失败时回滚并提示

### 4.6 "我的"空间（登录用户）

菜单结构：顶级 **我的** → 二级 **我创建的** / **我收藏的** / **账号设置**。

- MUST `GET /api/v1/me/capsules`：列表，返回当前用户创建的胶囊（含 `inPlaza = false`），支持 `page / pageSize`，按 `createdAt` 降序
- MUST `GET /api/v1/me/favorites`：列表，返回当前用户收藏的胶囊，按**收藏时间**降序；可能包含 `inPlaza = false` 的胶囊，前端 MUST 通过 `/capsules/:code` 打开，SHOULD 给这类胶囊标注"未公开"
- MUST `GET /api/v1/me/stats`：返回 `created`、`opened`、`unopened`、`inPlaza`、`favoritesReceived`、`favoritesGiven`；"我的"页头 MUST 展示其中至少「写下的胶囊」「等待开启」「被收藏」三项，二级菜单 SHOULD 显示"我创建的 / 我收藏的"数量
- MUST 个人资料页：`GET /api/v1/me`、`PATCH /api/v1/me`（修改 nickname / avatarId）
- MUST 修改密码：`POST /api/v1/me/password`

**4.6.1 删除**

- MUST 创建者能删除自己创建的胶囊（`DELETE /api/v1/me/capsules/{id}`），无论是否已到期、是否在广场
- MUST 删除不可恢复；服务端 MUST 在同一事务里一并删除该胶囊的所有收藏，它因此从所有人的「我收藏的」里消失
- MUST 界面用词统一为**「删除」**（不再使用"撤回"）；「我创建的」里每一枚胶囊（含已开启的）都显示删除按钮
- MUST 删除前弹出确认框，写明后果：胶囊被永久删除、持有胶囊码的人将无法再打开、它会从收藏过它的人的列表里消失、此操作不可恢复
- MUST NOT 提供任何更新 `content` / `openAt` 的接口（胶囊一经封存，内容与时间不可变）

### 4.7 首页、关于与页脚

- MUST **首页（`/`）主视图 = 胶囊广场**（列表 + 排序 + 过滤 + 搜索），不显示技术栈
- MUST 首页 hero 区提供两个主要入口：**创建胶囊**（未登录时跳登录）与**就地输码开启**（一个 8 位码输入框，输满自动查询，命中后进入 `/capsules/:code`，未命中就地提示）
- MUST 首页展示**广场概览**（来自 `/plaza/stats`）：广场上的胶囊数、等待开启数、已开启数、最远一枚的开启年份；`farthestOpenAt` 为 `null` 时该项隐藏
- MUST 页脚（所有页）展示当前运行的技术栈（从 `/api/v1/health` 动态获取）
- MUST 关于页（`/about`）包含：项目定位、「它能做什么」（六项功能）、「四条原则」、**本实现自己的**前后端技术栈（不列其他实现）、致谢、源码链接。功能与原则的文字两套皮肤相同，以 `spec/ui/copy.md` 为准

### 4.8 皮肤、主题与外观

- MUST 提供两套皮肤，功能、路由、文案完全一致，只有视觉与动效不同：
  - **时笺**（`paper`）：信笺与邮政的意象——纸色、朱印、邮戳、宋体标题
  - **琥珀**（`amber`）：琥珀与夜空的意象——胶囊形态、星空粒子、每枚胶囊一种专属色；明暗两色分别叫「晨曦」「星夜」
- MUST 每套皮肤各有明 / 暗两套主题，共四种组合；皮肤与明暗是两个独立开关
- MUST 默认皮肤为**琥珀**；默认明暗跟随系统 `prefers-color-scheme`
- MUST 选择持久化到 `localStorage`，并在**首帧之前**生效，不得闪出另一套皮肤或另一种明暗
- MUST 切换时保留页面状态（当前路由、滚动位置、表单草稿、广场筛选），不重新加载页面
- MUST 尊重 `prefers-reduced-motion`：关闭转场、粒子、长动画，只保留必要的状态变化
- MUST 颜色、间距、字号、圆角、阴影、动效曲线一律来自 `spec/styles` 下的令牌，组件层禁止硬编码色值
- MUST 响应式：桌面（≥ 1024px）+ 平板（≥ 768px）+ 手机（≥ 360px）；手机宽度下不得出现横向滚动，主导航 SHOULD 改为底部标签栏
- MUST 「琥珀」里每枚胶囊的专属色由胶囊码确定性算出（同一个码在任何实现里得到同一色相），算法见 `docs/02-design.md`；「时笺」不使用专属色
- SHOULD 未开启 / 已开启的卡片有不同的动效（例如未开启的"呼吸"）

### 4.9 页面清单（前端路由）

所有 5 个前端和 5 个全栈 MUST 实现同一套路由：

| 路由 | 页面 | 访问权限 |
|---|---|---|
| `/` | 首页（广场概览 + 就地输码 + 胶囊广场） | 公开 |
| `/create` | 创建胶囊 | 登录 |
| `/open` | 输入 8 位码开启胶囊（登录后附「我封存过的胶囊」） | 公开 |
| `/capsules/:code` | 胶囊详情（广场、开启页、我创建的、我收藏的都进这里） | 公开 |
| `/login` | 登录（支持 `?redirect=`） | 公开（已登录重定向首页） |
| `/register` | 注册（支持 `?redirect=`） | 公开（已登录重定向首页） |
| `/me` | 重定向到 `/me/created` | 登录 |
| `/me/created` | 我创建的 | 登录 |
| `/me/favorites` | 我收藏的 | 登录 |
| `/me/profile` | 账号设置（资料 / 修改密码） | 登录 |
| `/about` | 关于 | 公开 |

- MUST 1.x 的 `/c/:code` 与 `/plaza/:id` 不再保留
- SHOULD 未匹配的路径显示 404 页，提供回首页的入口

## 5. 非功能需求

### 5.1 性能（开发环境指标，单后端单前端本地运行）

- SHOULD 广场列表接口与广场统计接口 p95 < 200ms（5 万条数据）
- SHOULD 首页首屏（冷启动）< 2s
- SHOULD 「琥珀」的粒子背景在页面不可见时暂停，切到「时笺」时停止

### 5.2 安全

- MUST bcrypt 存密码，不存明文，不做可逆加密
- MUST JWT 用 HS256，access token 1h，refresh token 7d（可配置）
- MUST refresh token **rotate** + 黑名单
- MUST 输入校验在服务端（前端校验仅为体验）
- MUST 对所有写操作（POST/PATCH/DELETE）加 CSRF 防护（token 放 `HttpOnly` cookie 的栈）或纯 header token 策略
- SHOULD 登录接口加基础速率限制（同 IP 同邮箱 10/min）
- MUST 返回错误不泄露用户是否存在（统一 `UNAUTHORIZED`）
- MUST 登录回跳只接受站内路径（§4.1.7），防止开放重定向

### 5.3 可访问性（A11y）

- MUST 键盘全路径可操作（Tab / Enter / Space / Esc），包括长按类交互
- MUST 尊重 `prefers-reduced-motion`
- SHOULD 四种皮肤 × 明暗组合的正文对比度均符合 WCAG AA
- SHOULD 重要状态有非颜色标识（图标 / 文字）
- SHOULD 倒计时等频繁变化的区域不逐秒朗读（`aria-live` 只在状态变化时播报）

### 5.4 国际化

- MUST 本次聚焦**简体中文**为默认语言
- MAY 预留 i18n 脚手架，但不必完成英文翻译

### 5.5 浏览器支持

- MUST 最近 2 个版本的 Chrome / Safari / Firefox / Edge
- MAY 不支持 IE、老版本移动端浏览器
- MAY 使用 View Transitions、OKLCH、`offset-path` 等较新能力，但 MUST 在不支持的浏览器里退化为无动画的直接切换，不影响功能
- MUST 不依赖外网字体 CDN 才能正常显示：网络字体自托管，或回退到系统字体后版式不崩

### 5.6 可部署性

- MUST 每个实现 MUST 提供 `./run` 脚本本地起服务（无需参数即可运行）
- MUST 每个实现 MUST 提供 `./build` 脚本产出生产构建
- SHOULD 提供 `docker-compose.yml` 起 PostgreSQL + 参考后端 + 参考前端
- MUST 脚本**仅支持 macOS / Linux**，不提供 `.ps1`

## 6. 验收准则（整体）

一个实现被认为"完整"，需要同时满足：

1. 通过自动化契约验证（`verification/scripts/verify-contract.sh` 全部用例，含 2.0 新增的统计与收藏用例）
2. 前端 / 全栈通过自动化 UI 冒烟验证（`verify-ui-smoke.sh`），**在「时笺」与「琥珀」两套皮肤下各跑一遍**；用例只依赖 `spec/ui/testids.md` 规定的测试钩子
3. 前端 / 全栈通过设计令牌校验（`verify-design-tokens.sh`：不引用未声明的令牌、组件层无硬编码色值）
4. 有独立 README（安装、运行、测试、数据库切换说明）
5. 有 `./run`、`./build`、`./test` 三个脚本
6. 通过各自技术栈的 lint / format 门槛（eslint / black / gofmt / ktlint 等）
7. 使用 PostgreSQL 和 SQLite 两种模式各至少跑通一次（后端 / 全栈）
8. `/api/v1/health` 返回 `version: "2.0.0"`

## 7. 超出本次范围（Out of Scope）

以下条目在 2.0 中**不做**，即便未来可能做：

- 邮件验证 / 找回密码 / 动态验证码
- 第三方 OAuth 登录
- 用户自定义头像上传
- 胶囊评论、点赞（≠ 收藏）、分享到社交平台
- 胶囊富文本、图片 / 附件上传
- 胶囊定时推送通知、收藏到期提醒
- 管理员后台、用户封禁
- 桌面端与移动端客户端升级到 2.0（下一轮单独进行）
- 1.x 与 2.0 之间的能力协商或降级兼容
- Windows 原生脚本支持（`.ps1`）
- 正式多语言翻译
- 正式生产部署（K8s、CDN、SSL 终止等）

## 8. 术语与约定

- **胶囊（Capsule）**：业务主体对象，含 `title / content / openAt / code`
- **码（Code）**：8 位 `[A-Z0-9]` 唯一字符串，兼顾"分享链接"与"主键之一"
- **广场（Plaza）**：所有 `inPlaza = true` 胶囊的聚合视图
- **开启（Open）**：时间到达 `openAt` 后可阅读 `content`；"开启胶囊"页特指"通过码查询胶囊"这条路径
- **封存 / 封缄（Seal）**：创建胶囊的那一刻；之后内容与开启时间不可改
- **删除（Delete）**：创建者永久删除自己的胶囊；1.x 界面上的"撤回"即此操作，2.0 起统一叫"删除"
- **收藏（Favorite）**：用户对胶囊的关注关系，用于"我收藏的"列表和"最热"排序
- **皮肤（Skin）**：一整套视觉与动效方案，2.0 有「时笺」`paper` 与「琥珀」`amber`；与明暗主题（Theme）正交
- **测试钩子（Test hook）**：元素上的 `data-testid`，UI 冒烟唯一依赖的定位方式
- **栈（Stack）**：一个具体的后端 / 前端 / 全栈实现
- **参考实现（Reference Stack）**：第一个打通的实现（FastAPI + React），后续栈以其行为为事实标准

## 9. 未决问题（需要进一步澄清 / Roadmap 再定）

- 收藏是否触发到期提醒？当前无推送渠道，暂不做。
- 是否提供按作者浏览胶囊的入口（点击创建者昵称 → 该用户的公开胶囊列表）？当前未列入 MUST。

已在 2.0 定案、从本节移除的问题：自删除（MUST，见 §4.6.1）；广场的"情绪色"（由胶囊码算出的专属色，见 §4.8）。
