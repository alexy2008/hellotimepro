# HelloTime Pro 需求规格

> 版本 0.1 · 2026-04-17 · 作者 Claude · 面向对象：第一次接触本项目的新开发者

---

## 1. 项目定位

HelloTime Pro 是一个**多技术栈对比学习 / 教学项目**，业务载体是"时间胶囊"（用户写下一段内容，在未来某个时刻才可被打开阅读）。

本项目不是为生产运营设计的产品，而是围绕**同一套 API 契约 + 同一套设计系统 + 同一个业务模型**，让读者能横向对比：

- 10 个后端框架（Spring Boot / FastAPI / Gin / Elysia / NestJS / ASP.NET Core / Vapor / Axum / Drogon / Ktor）
- 5 个前端框架（Vue 3 / React / Angular / Svelte / Solid）
- 5 套全栈方案（Next.js / Nuxt / Spring MVC / Laravel / Rails）

每一个实现都必须是**"该技术栈本地 idiom"**而不是简单平移，但对外表现（API、UI、行为）必须一致。

与 [HelloTimeByClaude](https://github.com/<owner>/HelloTimeByClaude) 的关系：Pro 是一次**破坏式升级**，不做数据迁移、不兼容旧 API、不保留管理员模块。

## 2. 本次升级的核心变化（对老版本读者）

| 维度 | v1 HelloTime | v2 HelloTime Pro |
|---|---|---|
| 用户账号 | 无 | 电子邮件 + 密码，昵称唯一，内置头像 |
| 胶囊归属 | 匿名（仅 `creator` 字符串） | 归属到注册用户（匿名用户无法创建） |
| 首页主体 | 创建 / 开启入口 + 技术栈展示 | **胶囊广场**（列表）+ 创建 / 开启入口 |
| 胶囊可见性 | 靠 8 位码半私密分享 | 二元：`in_plaza` 开关（默认开）+ 8 位码仍可分享 |
| 广场与排序 | 无 | 支持最热（收藏数）/ 最新排序、已开 / 未开过滤 |
| 收藏 | 无 | 登录用户可收藏任意胶囊 |
| 管理员 | 有（管理胶囊） | **移除** |
| 数据库 | SQLite | PostgreSQL 为主，SQLite 可选，环境变量切换 |
| 桌面端 / 移动端 | 4 桌面 + 1 移动 | **不再包含**（聚焦 Web 栈） |
| 脚本支持平台 | Unix + Windows PowerShell | **仅 macOS / Linux** |
| 技术栈展示 | 首页显著展示 | 仅在页脚和"关于"页展示 |

## 3. 使用场景与用户角色

### 3.1 角色

| 角色 | 描述 | 能做 | 不能做 |
|---|---|---|---|
| **匿名用户** | 未登录访客 | 浏览广场、排序、过滤、通过 8 位码开启胶囊、阅读已到期公开胶囊 | 创建胶囊、收藏、查看"我的" |
| **注册用户** | 已登录用户 | 匿名用户的一切 + 创建胶囊 + 收藏 / 取消收藏 + 查看"我创建的 / 我收藏的" + 修改密码、昵称、头像 | 管理他人胶囊、删除他人内容 |

没有管理员角色。

### 3.2 代表性使用旅程

1. **匿名浏览** — 打开首页，看到胶囊广场，按"最新"浏览，对某个胶囊感兴趣，点击进入（若已到期）阅读；或想收藏，触发登录提示。
2. **注册发胶囊** — 点"注册"，填邮箱 / 密码 / 昵称 / 选头像，注册即登录；回到首页点"创建胶囊"，写内容、选开启时间、确认"加入广场"（默认勾选），获得 8 位码可分享。
3. **通过码开启** — 访客从外部链接拿到 8 位码，进入"开启胶囊"页输入码，若已到期则可读，未到期则看到倒计时。
4. **收藏与回访** — 登录用户在广场看到别人未开启的胶囊，收藏，进入"我的 → 我收藏的"，到期时回来阅读。

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

**4.1.5 修改密码**

- MUST 需提供当前密码 + 新密码
- MUST 修改成功后吊销该用户所有已存在的 refresh token（强制其他设备重新登录）

**4.1.6 修改昵称与头像**

- MUST 可修改 `nickname`（唯一性约束同注册）和 `avatarId`
- MUST NOT 支持修改邮箱
- MUST NOT 支持上传自定义头像

### 4.2 胶囊创建（登录用户）

- MUST 字段：`title`（1–60 字符）、`content`（1–5000 字符）、`openAt`（ISO 8601 UTC，必须晚于当前时间 + 1 分钟）、`inPlaza`（布尔，默认 `true`）
- MUST 创建者是当前登录用户，不再需要 `creator` 字段
- MUST 服务端生成 8 位 `[A-Z0-9]` 唯一码
- MUST `openAt` 接受的最大范围：当前时间 + 10 年；超出返回 `VALIDATION_ERROR`
- SHOULD 返回完整胶囊对象（含 `code`）

### 4.3 胶囊查询

**4.3.1 按 8 位码查询（任何用户）**

- MUST 路径：`GET /api/v1/capsules/{code}`
- MUST 未到期 (`openAt > now`)：返回 meta（`code`、`title`、`creator` 摘要、`openAt`、`createdAt`、`inPlaza`），`content = null`
- MUST 已到期：返回完整字段 + `content`
- MUST 不存在：`404 CAPSULE_NOT_FOUND`
- MUST `inPlaza = false` 的胶囊也可通过此路径查询（码即凭证）

**4.3.2 按胶囊 ID 查询（广场详情）**

- MUST 路径：`GET /api/v1/plaza/capsules/{id}`
- MUST 仅对 `inPlaza = true` 的胶囊可见；`false` 返回 `404`
- MUST 行为与 4.3.1 一致（未到期隐藏 content）

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

### 4.5 收藏（登录用户）

- MUST 登录用户可收藏任意 `inPlaza = true` 的胶囊（含未开启）
- MUST **不能**收藏自己创建的胶囊（服务端拒绝，返回 `BAD_REQUEST`）
- MUST **不能**收藏 `inPlaza = false` 的胶囊（即使有码）
- MUST `POST /api/v1/me/favorites` body `{ capsuleId }`；`DELETE /api/v1/me/favorites/{capsuleId}`
- MUST 匿名用户触发收藏操作时，前端 SHOULD 弹出登录提示（跳转到登录页并携带 `redirect` 参数）

### 4.6 "我的"空间（登录用户）

菜单结构：顶级 **我的** → 二级 **我创建的** / **我收藏的**。

- MUST `GET /api/v1/me/capsules`：列表，返回当前用户创建的胶囊，支持 `page / pageSize`，按 `createdAt` 降序
- MUST `GET /api/v1/me/favorites`：列表，返回当前用户收藏的胶囊，按**收藏时间**降序
- MUST 个人资料页：`GET /api/v1/me`、`PATCH /api/v1/me`（修改 nickname / avatarId）
- MUST 修改密码：`POST /api/v1/me/password`

创建者 MUST 能删除自己创建的胶囊（`DELETE /api/v1/me/capsules/{id}`），无论是否已到期。
创建者 MUST NOT 能修改胶囊的 `content` 或 `openAt`（胶囊一经创建即封存，内容和时间不可变）。
MUST NOT 提供任何更新 `content` / `openAt` 的接口。

### 4.7 首页、关于与页脚

- MUST **首页（`/`）主视图 = 胶囊广场**（列表 + 排序 + 过滤），不显示技术栈
- MUST 首页顶部 hero 区 MUST 提供两个主要 CTA：**创建胶囊** / **通过码开启**
- MUST 创建 CTA 对未登录用户点击时，跳转登录页
- MUST 页脚（所有页）MUST 展示当前运行的技术栈（从 `/api/v1/health` 动态获取）
- MUST 关于页（`/about`）详细展示：项目定位、技术栈、致谢、源码链接

### 4.8 主题与外观

- MUST 沿用 v1 的 cyber 主题基调（深色霓虹 + 单色强调），**但**重新梳理设计令牌：
  - 引入色阶系统（50/100/200…900）替代 v1 的硬编码色
  - 引入语义化色（`color-brand-primary`、`color-plaza-card-bg` 等）
  - 统一字号、间距、圆角、阴影、动画曲线令牌
- MUST 支持明亮 / 深色主题切换，持久化到 `localStorage`
- MUST 响应式：桌面（≥ 1024px）+ 平板（≥ 768px）+ 手机（≥ 360px）
- SHOULD 胶囊卡片提供"呼吸感"动画（未开启 / 已开启不同视觉）

### 4.9 页面清单（前端路由）

所有 5 个前端和 5 个全栈 MUST 实现同一套路由：

| 路由 | 页面 | 访问权限 |
|---|---|---|
| `/` | 首页（胶囊广场 + CTA） | 公开 |
| `/create` | 创建胶囊 | 登录 |
| `/open` | 输入 8 位码开启胶囊 | 公开 |
| `/capsules/:code` | 通过码查看胶囊（开启页的结果页） | 公开 |
| `/plaza/:id` | 广场中的胶囊详情 | 公开 |
| `/login` | 登录 | 公开（已登录重定向首页） |
| `/register` | 注册 | 公开（已登录重定向首页） |
| `/me` | 我的（默认展示"我创建的"） | 登录 |
| `/me/created` | 我创建的 | 登录 |
| `/me/favorites` | 我收藏的 | 登录 |
| `/me/profile` | 个人资料 / 修改密码 | 登录 |
| `/about` | 关于 | 公开 |

## 5. 非功能需求

### 5.1 性能（开发环境指标，单后端单前端本地运行）

- SHOULD 广场列表接口 p95 < 200ms（5 万条数据）
- SHOULD 首页首屏（冷启动）< 2s

### 5.2 安全

- MUST bcrypt 存密码，不存明文，不做可逆加密
- MUST JWT 用 HS256，access token 1h，refresh token 7d（可配置）
- MUST refresh token **rotate** + 黑名单
- MUST 输入校验在服务端（前端校验仅为体验）
- MUST 对所有写操作（POST/PATCH/DELETE）加 CSRF 防护（token 放 `HttpOnly` cookie 的栈）或纯 header token 策略
- SHOULD 登录接口加基础速率限制（同 IP 同邮箱 10/min）
- MUST 返回错误不泄露用户是否存在（统一 `UNAUTHORIZED`）

### 5.3 可访问性（A11y）

- SHOULD 键盘全路径可操作（Tab / Enter / Esc）
- SHOULD 颜色对比度符合 WCAG AA
- SHOULD 重要状态有非颜色标识（图标 / 文字）

### 5.4 国际化

- MUST 本次聚焦**简体中文**为默认语言
- MAY 预留 i18n 脚手架，但不必完成英文翻译

### 5.5 浏览器支持

- MUST 最近 2 个版本的 Chrome / Safari / Firefox / Edge
- MAY 不支持 IE、老版本移动端浏览器

### 5.6 可部署性

- MUST 每个实现 MUST 提供 `./run` 脚本本地起服务（无需参数即可运行）
- MUST 每个实现 MUST 提供 `./build` 脚本产出生产构建
- SHOULD 提供 `docker-compose.yml` 起 PostgreSQL + 参考后端 + 参考前端
- MUST 脚本**仅支持 macOS / Linux**，不提供 `.ps1`

## 6. 验收准则（整体）

一个实现被认为"完整"，需要同时满足：

1. 通过自动化契约验证（调用 `verification/scripts/verify-contract.sh` 对该实现跑通）
2. 通过自动化 UI 冒烟验证（对前端 / 全栈跑 `verify-ui-smoke.sh`）
3. 有独立 README（安装、运行、测试、数据库切换说明）
4. 有 `./run`、`./build`、`./test` 三个脚本
5. 通过各自技术栈的 lint / format 门槛（eslint / black / gofmt / ktlint 等）
6. 使用 PostgreSQL 和 SQLite 两种模式各至少跑通一次（后端 / 全栈）

## 7. 超出本次范围（Out of Scope）

以下条目在 Pro v1 中**不做**，即便未来可能做：

- 邮件验证 / 找回密码 / 动态验证码
- 第三方 OAuth 登录
- 用户自定义头像上传
- 胶囊评论、点赞（≠ 收藏）、分享到社交平台
- 胶囊富文本、图片 / 附件上传
- 胶囊定时推送通知
- 管理员后台、用户封禁
- 桌面端、移动端原生壳
- Windows 原生脚本支持（`.ps1`）
- 正式多语言翻译
- 正式生产部署（K8s、CDN、SSL 终止等）

## 8. 术语与约定

- **胶囊（Capsule）**：业务主体对象，含 `title / content / openAt / code`
- **码（Code）**：8 位 `[A-Z0-9]` 唯一字符串，兼顾"分享链接"与"主键之一"
- **广场（Plaza）**：所有 `inPlaza = true` 胶囊的聚合视图
- **开启（Open）**：时间到达 `openAt` 后可阅读 `content`；"开启胶囊"页特指"通过码查询胶囊"这条路径
- **收藏（Favorite）**：用户对胶囊的关注关系，用于"我收藏的"列表和"最热"排序
- **栈（Stack）**：一个具体的后端 / 前端 / 全栈实现
- **参考实现（Reference Stack）**：第一个打通的实现，后续栈以其行为为事实标准

## 9. 未决问题（需要进一步澄清 / Roadmap 再定）

- 自删除自创建胶囊是否在 v1 开启？（当前标记 MAY，Roadmap M4 再定）
- 广场的"封面图"或"情绪色"是否引入？目前只有文字。
- 收藏是否触发到期提醒？当前无推送渠道，暂不做。
- 是否提供按作者浏览胶囊的入口（点击创建者昵称 → 该用户的公开胶囊列表）？当前未列入 MUST。
