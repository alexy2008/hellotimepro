# HelloTime Pro · Nuxt 3 全栈（2.0）

Nuxt 和 Nitro 在同一个 Node 进程提供页面与 `/api/v1/*`。页面对齐 React 参考实现的「时笺」「琥珀」双皮肤及明暗模式，接口对齐 FastAPI，数据库可选 PostgreSQL 或 SQLite。

## 运行

在仓库根目录执行。需要 Node.js 22+ 和 npm。

```bash
./scripts/db init
./scripts/hello start nuxt
./scripts/hello status
./scripts/hello stop nuxt
```

页面和接口都在 `http://localhost:7178`。开发管理器注入数据库和 LLM 配置，启动时构建 Nitro 的 Node 产物。建表、重置和导入演示数据由仓库的 `scripts/db` 执行。

```bash
export DB_DRIVER=sqlite
export DB_URL="sqlite:///${PWD}/data/sqlite/hellotime-nuxt.db"
./scripts/db init
./scripts/hello start nuxt
```

准备 SQLite 时使用 Nuxt 专属文件。把相同的 `DB_DRIVER=sqlite` 和 `DB_URL=sqlite:////绝对路径` 传给 `scripts/db init` 和 `scripts/hello start nuxt`。

| 脚本 | 用途 |
| --- | --- |
| `./fullstacks/nuxt/build` | 生产构建，静态图标和头像由 Nitro 打包 |
| `./fullstacks/nuxt/test` | Nuxt 类型检查与 SQLite 服务回归 |
| `npm run dev` | 在本目录用已准备好的数据库运行 Nuxt 热更新 |

## 页面

| 路径 | 功能 |
| --- | --- |
| `/` | 广场年鉴、精选、排序、筛选、搜索和就地输码 |
| `/open` | 凭码开启，登录后可快捷查看最近封存的胶囊 |
| `/capsules/:code` | 凭码看详情。到点后等待服务端确认，再展示正文 |
| `/create` | 账号草稿、AI 灵感与代笔、开启时刻、公开选项和封存回执 |
| `/register`、`/login` | 注册、登录和站内回跳 |
| `/me/created`、`/me/favorites`、`/me/profile` | 统计、分页列表、删除、取消收藏、账号设置 |
| `/about` | 产品功能、项目原则、实际使用的技术栈 |
| 其他路径 | 双皮肤 404 |

## 实现导览

- `pages/` 定义文件路由。广场和胶囊详情通过 `useAsyncData` 调用同进程 Nitro API，服务端输出匿名首屏。登录、注册、创建和账号区由浏览器恢复本地会话后执行路由中间件。
- `layouts/` 负责站点外壳。`skins/{paper,amber}/` 承载各自 DOM 与动效。`composables/`、`stores/` 和 `components/` 复用表单、搜索、输码、收藏与确认交互。时笺用时间标尺和日历，琥珀用星轨时钟。
- `server/api/v1/` 按方法和路径生成 Nitro 端点。H3 与 Zod 校验输入，服务层持有业务规则，`server/db/` 通过 Drizzle 接入双数据库。
- 样式由 `styles/index.css` 按顺序引入 `spec/styles`，时笺字体自托管。关于和页脚从本机 `/api/v1/health` 读取服务端与数据库信息。

更多实现细节见 [技术手册](TECHNICAL_GUIDE.md)。

## 2.0 验证

验证日期为 2026-11-22。契约与 UI 冒烟分别使用 Nuxt 专属验证库。

| 数据库 | HTTP 契约 | UI 冒烟（时笺与琥珀） |
| --- | --- | --- |
| PostgreSQL | 117/117 | 88/88 |
| SQLite | 117/117 | 88/88 |

生产构建、Nuxt 类型检查、设计令牌检查通过。SQLite 服务回归通过 6/6，覆盖关闭外键时的连带删除。另用 Chromium 检查了首次换肤、跨时区打开公开页、匿名直达创建页回跳、移动端星轨时钟、搜索失败后重试及手动输入作废旧代笔响应。

## 2.0 迁移笔记

- SSR 先用皮肤偏好 Cookie 选择首屏视图。浏览器首帧脚本读取 `localStorage` 写好皮肤和明暗。若本地皮肤和 SSR 标记不同，等 Nuxt 的页面接管完成后再切换可见内容。Cookie 只记录皮肤。
- SQLite 同时读取种子数据的 32 位 UUID 和应用写入的标准 UUID。对外统一输出标准格式，写收藏与删除时使用库中的实际主键。SQLite 对新旧 ISO 文本按实际时间比较。
- PostgreSQL 先锁胶囊行再更新收藏。SQLite 用串行写连接和 `BEGIN IMMEDIATE`。两种数据库都在同一事务内维护计数，删除胶囊时显式删除收藏。
- 浏览器详情使用 2.0 的 `/capsules/:code`。旧版本库中的胶囊仍可用原码查询，2.0 沿用原表结构。
