# HelloTime Pro Rails 2.0 技术手册

## 一次请求如何走过 Rails

Rails 把页面路由与 JSON API 安排在同一个进程中。网页请求由 `ApplicationController` 系列控制器处理，加载用户后将结果传给 ERB。API 请求由 `Api::V1::BaseController` 处理，校验 Bearer JWT，并把领域结果包装成规范中的 JSON。两条入口共用 `CapsuleService`、`PlazaService`、`FavoriteService` 和 `AuthService`。

| 位置 | 职责 |
|---|---|
| `config/routes.rb` | 网页、`/api/v1` 和用于局部更新的 `/ui` 路由 |
| `app/controllers/concerns/` | 网页 Cookie 登录态、API Bearer 校验 |
| `app/views/` | 布局、页面及 ERB partial；`skins/` 放两套皮肤的插画和时间控件 |
| `app/javascript/controllers/` | 按组件组织的 Stimulus 控制器 |
| `app/javascript/lib/` | 请求、反馈、日期与草稿工具 |
| `app/models/`、`app/lib/cross_db.rb` | Active Record 关联、查询作用域和跨库类型 |
| `app/services/` | 应用用例、校验、契约序列化和 AI 服务 |

例如直接访问 `/capsules/ABCD1234` 时，`PublicController#capsule` 先从服务读取胶囊，再渲染详情 HTML。若尚未开启，服务输出 `content: nil`，模板只渲染计时器。浏览器倒数归零后，从 Rails 查询详情片段。服务确认已开启时，控制器替换详情区域。初次加载区分查无此码和可重试的故障。

## Turbo 与 Stimulus 各负责什么

- Turbo Drive 拦截站内导航，并处理登录、注册、登出、资料和密码表单的响应。成功后 Rails 返回 303 重定向，校验失败时用 422 渲染字段反馈。
- 广场与个人中心的片段由 Rails 生成。广场的 Stimulus 控制器保留搜索框，输入防抖后取消旧请求，并从同一响应更新卡片和筛选数量。渲染个人列表的请求带上当前需要显示的条数，删除或取消收藏后根据服务端现有顺序重读列表前缀，随后从仍然显示的条数继续加载。
- 创建页以表单内容的快照发出封存请求。服务器提交后用 Turbo Stream 填入回执。同一个 Stimulus 控制器持有提交锁，回执可以在两套皮肤下显示。清理草稿时按快照身份核对，等待期间新编辑的内容可从「再写一枚」继续。草稿保存在当前浏览器页面会话的内存中，Turbo 导航继续使用，登出或切换账号时清空。
- AI 推荐和代笔调用同源 API。代笔等待或填字期间编辑标题、正文或开启时间会取消该次任务。正文等到响应成功才写入。输码和倒计时也有各自的取消信号，避免旧页面或旧皮肤完成后写回当前界面。
- 网页登录态由服务端读取访问 Cookie。网页导航遇到过期 token 时可使用 refresh token 续期，浏览器直接请求同源 JSON API 时由 Cookie-to-Bearer 中间件注入访问 token。

## 两套皮肤与时间选择

布局在 CSS 加载前把 `hellotime.skin` 和 `hellotime.theme` 写入 `<html>` 的数据属性。Propshaft 根据样式入口的 `@import` 加载根目录的 `spec/styles`，按 base、时笺、琥珀、shell 的顺序生效。页面模板共用业务字段与可操作节点，用皮肤专属 partial 装配信封、星轨、时钟等不同结构。换肤时更改根属性，原表单节点继续持有值、焦点和进行中的操作。

创建页保存一个 UTC ISO 开启时刻。时笺用非线性标尺和月历选择日期及时刻。琥珀在触发条下展开星轨时钟，滑轨换日期时保留本地时刻，表盘用累加角度跨过 12 点，日历和表盘都接受键盘操作。两个时间控件从同一个时刻同步显示，预设或 AI 建议写入后也会同步。时钟展开后会在动画结束时检查可见区域并补滚一次。

## PostgreSQL 与 SQLite

PostgreSQL 的 UUID 和时间戳使用 Active Record 原生列类型。SQLite 用自定义 `ActiveRecord::Type` 处理 UUID 和时间文本。通过 UUID 请求时同时查两种已有表示，写收藏和删除时使用找到的行原始主键。SQLite 的日期比较统一到等宽 UTC 字符串，再用于开封边界和排序。

`Capsule.published`、`opened_by`、`opening_after` 和广场搜索作用域让统计和分页共用同一口径。SQL `LIKE` 的模式通过 Rails 的 `sanitize_sql_like` 生成，声明同一个转义字符。最远和最近开启时刻直接从有序列取值，保留列类型和空值含义。

收藏、取消收藏和删除在同一事务操作胶囊及收藏行。PostgreSQL 先锁胶囊行，再读写收藏，三种操作保持同一顺序。SQLite 在 Rails 8.1 使用立即写事务，并保持单连接池。删除在事务中显式删除关联收藏。封存上限通过 UTC 时间的日历年运算计算，闰日落到目标年的二月末。

`./test` 通过 Rails runner 在临时 SQLite 文件中加载规范 schema 并关闭外键，覆盖自藏未公开胶囊、显式连带删除、统计与字面搜索、路径 UUID 校验、同秒比较和闰日边界。完整接口与 UI 覆盖由仓库黑盒套件提供。
