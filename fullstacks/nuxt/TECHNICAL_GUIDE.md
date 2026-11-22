# HelloTime Pro · Nuxt 3 技术手册

## 1. 文件路由和混合渲染

`app.vue` 挂载 `NuxtLayout` 和 `NuxtPage`，站点布局提供页头、页脚、底栏、确认框与 Toast。`pages/index.vue`、`pages/capsules/[code].vue` 各自用 `useAsyncData` 发起同源 `$fetch`。在服务器渲染时，Nitro 在本进程执行对应 API 处理器。浏览器接管页面时复用 Nuxt payload。

广场首屏预取当前列表、统计与精选，并填入同一个 Pinia store。进入详情页时，路由按胶囊码取得结果，并用 `useHead` 设置页面标题。登录用户在接管页面后刷新列表或详情的 `favoritedByMe` 投影。

`nuxt.config.ts` 的 `routeRules` 给登录、注册、创建和个人中心使用客户端渲染。`plugins/bootstrap.ts` 在这些页面首次导航前恢复会话，`middleware/session.ts` 处理受保护页面及已登录用户的回跳。公开页面的会话恢复在 Nuxt 完成页面接管后执行。服务端没有浏览器的 `localStorage`，公开页首屏按匿名浏览者渲染。

`pages/me/[tab].vue` 用同一路由承载创建、收藏和资料页签。固定的页面 key 让切换页签时保留页头，页签内容在跳转时按需重载。

## 2. 皮肤和状态

`lib/preferences.ts` 为 `<head>` 提供首帧脚本。它读取浏览器偏好、处理系统明暗，并填写 `<html>` 的 `data-skin`、`data-theme`。选择皮肤时，Pinia 同步写入 `localStorage` 和供 SSR 使用的皮肤 Cookie。若两者不同，`app:suspense:resolve` 后先换成正确视图，再显示页面。View Transition 接收 `data-skin-dir`，由规范样式绘制柔光转场。减少动效模式下直接更新。

| 状态 | 持有位置 | 生命周期 |
| --- | --- | --- |
| 登录与单飞刷新 | `stores/auth.ts`、`api/client.ts` | 浏览器会话。访问令牌在内存中，刷新令牌和用户资料存于浏览器本地存储 |
| 皮肤和明暗 | `stores/ui.ts` | 按浏览器记住 |
| 广场筛选、页码与搜索防抖 | `stores/plaza.ts` | 同一页面应用内保留，切换皮肤不会重置 |
| 输码、创建提交锁与回执 | 文件路由用 `provide` 持有 | 同一路由内跨皮肤保留 |
| 草稿与账号表单 | `stores/draft.ts`、`stores/forms.ts` | 按账号隔离。换账号或登出时清理，账号表单离页时清理 |

创建路由用草稿版本号判断封存成功后是否应清空当前草稿。AI 代笔成功前保留原文，等候或逐字填入期间的手动修改会让旧请求失效。「我的」列表删除一项后，根据仍显示的条数重读分页边界，再按胶囊 ID 去重。

`useNow` 以 SSR payload 中的时间初始化，随后按浏览器整秒推进。界面的日期按浏览器时区显示。详情的开启动画由皮肤视图管理，胶囊读取状态由路由持有。倒数结束后只展示服务器确认的开启状态，未确认时按 1 秒、2 秒逐步退避，上限 5 秒。换码、离开页面或换肤都会取消旧视图的等待。

## 3. Nitro 接口

文件名同时声明路径和 HTTP 方法。例如 `server/api/v1/plaza/stats.get.ts` 对应 `GET /api/v1/plaza/stats`。`server/lib/envelope.ts` 负责统一响应结构与 HTTP 状态。Zod 校验请求体，`server/lib/query.ts` 校验搜索、排序、筛选和分页，路径 UUID 在数据访问前校验。

`server/services/plaza.ts` 给广场列表与统计共用公开和搜索条件。反斜杠、百分号、下划线按字面搜索。统计对同一个时间点计数，最近和最远时刻只由公开胶囊决定。`me/stats` 计入私密胶囊、收到的所有收藏和当前账号给出的收藏。

`server/lib/current-user.ts` 从 Bearer token 解析身份。令牌轮换和族追踪由 `server/services/auth.ts` 管理，浏览器客户端负责把续期合并为单个请求。登录态改变后，旧会话的续期和 `/me` 响应不会写回当前会话。AI 走现有 LLM 客户端，代笔在模型不可用时使用本地模板，推荐在模型不可用时返回空列表。

## 4. Drizzle 双数据库

`server/db/index.ts` 按 `DB_DRIVER` 动态加载 node-postgres 或 better-sqlite3。两套 Drizzle schema 共享 JS 字段名，保留数据库列的方言类型。PostgreSQL 使用原生 UUID 和 timestamptz，SQLite 使用 TEXT。服务端读到 SQLite 的种子主键后，用原值写外键，API 回包通过 `records.ts` 统一为带连字符的 UUID 与 UTC 时间。

收藏、取消收藏和删除都通过 `withCapsuleTransaction`。PostgreSQL 用 Drizzle 事务并先锁胶囊行。SQLite 用单独的串行写连接，进入事务时先取写锁。收藏行与冗余计数在同一事务内更新。删除先清理收藏行再删除胶囊，所以 SQLite 关闭外键时结果也一致。

## 5. 样式与资产

时笺和琥珀各有自己的模板，组件沿用规范定义的类名与测试钩子。共享部件在 `components/`，测试定位规则见 [UI 测试钩子](../../spec/ui/testids.md)。`styles/index.css` 依次引入基础令牌、时笺、琥珀和公共外壳样式。头像目录和徽记直接取自 `spec/avatars/v2/`，Nitro 提供相同版本的静态资源。

## 6. 验证

`./test` 执行 Nuxt 类型检查和 SQLite 服务回归。回归覆盖闰日上限、Unicode 校验、路径 UUID、字面搜索、幂等并发收藏及关闭外键后的连带删除。全栈 HTTP 契约和 UI 冒烟从公共入口验证，使用各自的专属 PostgreSQL 或 SQLite 库。契约脚本会重置和播种传入的库，冒烟脚本会创建和清理测试账号。运行方式见 [2.0 升级指南](../../docs/05-upgrade-2.0.md)。
