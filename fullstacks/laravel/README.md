# HelloTime Pro · Laravel 全栈（2.0）

PHP 8.5 + **Laravel 13 + Eloquent ORM + Blade + Alpine.js 3** 的 HelloTime Pro 全栈实现，端口 **7182**。

同一个 Laravel 进程同时承载：

- **JSON 契约 API（`/api/v1/*`）**：对齐 `spec/api/openapi.yaml` 2.0.0 与参考后端 `backends/fastapi`，契约验证通过 Bearer token 黑盒访问，双库支持 PostgreSQL 与 SQLite。
- **双皮肤服务端渲染 UI（「时笺」`paper` / 「琥珀」`amber` × 明暗）**：对齐参考前端 `frontends/react-ts` 与 2.0 原型，Blade 服务端直出首屏数据与皮肤结构，Alpine.js 3 承载无刷新换肤、时间标尺、星轨时钟、长按封缄、倒计时自动开启与表单交互，样式原样引入 `spec/styles` 2.0（不再使用 Tailwind）。

这个实现对应 `docs/03-roadmap.md` 中的「Laravel：Blade + Alpine.js；PHP 现代全栈的最佳代表」。完整代码导读见 [`TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)。

## 技术栈

| 角色 | 选型 |
|---|---|
| 语言 | PHP 8.5 |
| 框架 | Laravel 13.14 |
| ORM | Eloquent ORM（模型 + 关系 + `CrossDbBoolean` 自定义 Cast + `HasCrossDbKey`） |
| 模板引擎 | Blade（双皮肤视图分离 + `View::composer` 注入公共上下文） |
| 渐进增强 | Alpine.js 3（无构建直出，按领域拆分 4 个脚本模块） |
| 数据库 | PostgreSQL 16 / SQLite 3 双驱动 |
| 鉴权 | Laravel Hash（bcrypt）+ HS256 JWT + refresh token 轮换与家族追踪；API 支持 Bearer 与同源 httpOnly cookie 双解析 |
| 样式 | `spec/styles` 2.0（base → 时笺 → 琥珀 → shell）+ `@fontsource` 自托管字体 + `public/css/laravel.css`（2 行胶水，零 Tailwind） |

## 快速开始

数据库 schema 与演示数据由仓库级 `./scripts/db` 维护，`./run` 只启动服务，不建表、不迁移、不 seed。

```bash
# PostgreSQL（默认）
./scripts/db reset --seed
./scripts/hello start laravel

# SQLite
DB_DRIVER=sqlite ./scripts/db reset --seed
DB_DRIVER=sqlite ./scripts/hello start laravel
```

打开 <http://127.0.0.1:7182>。

## 脚本

```bash
cd fullstacks/laravel
./build   # composer install + npm install + scripts-sync-assets.sh 同步静态资源
./test    # PHPUnit 单元与 2.0 接口回归测试（19 个用例）
./run     # 自动同步静态资源并以 PHP 内置服务器启动（端口 7182）
```

`scripts-sync-assets.sh` 负责将 `alpine.min.js`、`spec/styles` 2.0 原样拷贝、`spec/avatars/v2/*.svg` 以及 `@fontsource/*` 字体同步到 `public/`（`public/fonts` 与 `public/styles` 已在 `.gitignore` 中忽略，每次 `./build` / `./run` 自动生成，避免提交 86 MB 字体文件）。

## 目录结构

```text
fullstacks/laravel/
├── routes/
│   ├── api.php                                     # /api/v1/* JSON 契约（含 plaza/stats、me/stats）
│   └── web.php                                     # Blade 页面路由与 404 fallback
├── app/
│   ├── Http/Controllers/
│   │   ├── Api/V1/HelloTimeApiController.php       # JSON 契约入口 + auth cookie 同步
│   │   └── Web/{Page,Auth}Controller.php           # SSR 首屏直出 + 服务端 302 路由守卫
│   ├── Models/
│   │   ├── {User,Capsule,Favorite,RefreshToken}.php
│   │   └── Concerns/HasCrossDbKey.php              # 字符串 UUID 主键生成
│   ├── Casts/CrossDbBoolean.php                    # PostgreSQL 't'/'f' 与 SQLite 0/1 归一
│   ├── Providers/AppServiceProvider.php            # SQLite Unicode LOWER 注册 + View::composer
│   ├── Services/                                   # Auth / Capsule / Plaza / Favorite / Profile / Suggestion / Health / AvatarCatalog / LlmClient
│   ├── Support/                                    # CrossDb / Mapper / Validation / JwtCodec / Formatter / UiHelper
│   └── Exceptions/{ApiError,LlmException}.php
├── resources/views/
│   ├── layouts/app.blade.php                       # 首帧防闪脚本 + 字体/spec 样式 + 皮肤外壳切换
│   ├── components/                                 # skin-switch / user-menu / feedback / fav-button（两套皮肤共用）
│   ├── pages/                                      # home / open / detail / create / login / register / me / about / not-found
│   └── skins/{paper,amber}/                        # 两套皮肤的 header / footer / tabbar / card / code-input / 各页视图 / 琥珀星轨时钟
├── public/
│   ├── css/laravel.css                             # 仅 [x-cloak] 与 .list-more（只用语义令牌）
│   └── js/                                         # alpine.min.js + ht-core / ht-plaza / ht-create / ht-capsule-account
├── tests/
│   ├── Unit/{CrossDbTest,JwtCodecTest}.php
│   └── Feature/ApiV2RegressionTest.php             # 含关 SQLite 外键删收藏、日历年闰日、字面 LIKE、422 UUID 等回归
├── scripts-sync-assets.sh
└── run / build / test
```

## 路由

| 路由 | 页面 | 权限 | 说明 |
|---|---|---|---|
| `/` | 首页（广场概览 + 就地输码 + 胶囊广场） | 公开 | 服务端直出首屏列表、筛选数、年鉴与精选 |
| `/open` | 凭码开启（登录后附「我封存过的胶囊」） | 公开 | 8 格输码跨皮肤保留 |
| `/capsules/{code}` | 胶囊详情（`/c/{code}` 301 重定向） | 公开 | 倒计时归零以服务端 `isOpened` 为准自动开启；查无此码返回 404 + `detail-not-found` |
| `/create` | 写一枚胶囊 | 登录 | 服务端 302 守卫；按账号隔离草稿；时笺标尺+长按火漆 / 琥珀星轨时钟 |
| `/login` · `/register` | 登录 / 注册（支持 `?redirect=`） | 公开 | 已登录服务端 302 回首页；表单值跨皮肤保留 |
| `/me/created` · `/me/favorites` · `/me/profile` | 我的（`/me` 跳转 `/me/created`） | 登录 | 服务端 302 守卫；支持 `list-next` 边界页重读与去重 |
| `/about` | 关于 | 公开 | 展示 Laravel 界面层与服务端技术栈（源自 `HealthService`） |

## 设计要点

- **逻辑一份，皮肤按 `<template x-if>` 挂载**：每个页面的业务状态（搜索词与防抖计时器、8 格输码、创建页草稿与提交锁、登录/注册/资料表单、倒计时启封轮询）都放在外层 Alpine `x-data` 中，两套皮肤的 Blade 视图分别挂在 `<template x-if="$store.ui.skin === 'paper|amber'">` 下。切换皮肤时只替换活跃视图的 DOM（保证页面上不会出现隐藏重复的 `data-testid`），表单输入、筛选条件和草稿无缝保留。
- **首帧零闪烁 + 柔光拂过换肤**：`<head>` 内联脚本在首帧前根据 `localStorage`（`hellotime.skin` / `hellotime.theme`）写好 `<html data-skin data-theme>` 与 `theme-color`。切换皮肤写入 `data-skin-dir="prev|next"` 触发 `spec/styles/shell.css` 的柔光拂过转场，明暗切换使用圆形 `clipPath` View Transition。
- **同源会话与服务端守卫**：API 保持标准 Bearer 契约，同时在 `/api/v1/auth/{register,login,refresh,logout}` 与 `/api/v1/me/password` 同步维护 `ht_access` / `ht_refresh` httpOnly cookie。受保护页面（`/create`、`/me/*`）由控制器首帧 302 跳转到 `/login?redirect=…`，前端登出时先等待 `/api/v1/auth/logout` 清完 cookie 再更新 UI 或跳转，消除竞态。
- **双库一致的 Eloquent 层**：`CrossDb` 与 `CrossDbBoolean` 屏蔽 PostgreSQL 原生 UUID / `timestamptz` / `'t'/'f'` 与 SQLite 32-hex / 微秒 ISO 文本 / `0/1` 的差异；SQLite 连接注册 Unicode `LOWER` 并启用 `BEGIN IMMEDIATE` 与 `busy_timeout=5000`；PostgreSQL 删除与收藏严格遵守「先锁胶囊行、再操作收藏」的加锁顺序。

## 2.0 验证

验证日期：**2026-11-23**（独立库验证，PostgreSQL 使用 `hellotime_contract_laravel`，SQLite 使用 `/tmp/hellotime-contract-laravel.db` 与 `/tmp/hellotime-ui-laravel.db`）：

| 验证项 | PostgreSQL | SQLite |
|---|---|---|
| API 契约 `verify-contract.sh laravel` | ✅ 117/117 | ✅ 117/117 |
| UI 冒烟 `verify-ui-smoke.sh laravel`（44 条 × 时笺 / 琥珀） | ✅ 88/88 | ✅ 88/88 |
| 设计令牌 `verify-design-tokens.sh laravel` | ✅ 通过（扫描 12 个样式文件） | — |
| 构建与单测 `./build && ./test` | ✅ 19/19 通过（115 assertions） | — |

复现命令：

```bash
DB_URL=postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_laravel ./verification/scripts/verify-contract.sh laravel
DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-contract-laravel.db ./verification/scripts/verify-contract.sh laravel

DB_URL=postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_laravel ./scripts/db reset --seed --yes
DB_URL=postgresql+psycopg://<user>:<pwd>@127.0.0.1:5432/hellotime_contract_laravel ./verification/scripts/verify-ui-smoke.sh laravel

DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-ui-laravel.db ./scripts/db reset --seed --yes
DB_DRIVER=sqlite DB_URL=sqlite:////tmp/hellotime-ui-laravel.db ./verification/scripts/verify-ui-smoke.sh laravel

./verification/scripts/verify-design-tokens.sh laravel
(cd fullstacks/laravel && ./build && ./test)
```

## 2.0 迁移笔记

升级指南第 1、2 节清单已逐条对齐；以下是本次 Laravel + Blade + Alpine.js 升级中额外遇到的栈内细节：

1. **Alpine.js 布尔属性与条件 `data-testid`**：Alpine 将绑定值为 `false` 的属性直接从 DOM 移除。凡是测试钩子断言 `"true"` / `"false"` 的属性（`aria-pressed`、`aria-checked`、`aria-expanded`、`data-selected`、`data-in-plaza`）必须显式绑定字符串 `'true' : 'false'`；而条件出现的 `data-testid` 绑定 `cond ? 'testid' : null`，确保为假时彻底移出 DOM。
2. **HTML 解析器不支持 `<svg>` 内嵌 `<template x-for>`**：浏览器解析 SVG 命名空间中的 `<template>` 会破坏子节点树。星轨时钟表盘的 60 根刻度线、60 格表圈标记、11 个年份节点、首页主视觉星芒与收藏爆裂粒子全部改为在 Blade 服务端 `@for` / `@foreach` 直接输出静态 SVG 节点，再由 Alpine 控制旋转与类名。
3. **登出时 httpOnly cookie 清除顺序与受保护路由跳转竞态**：若前端先同步将 `$store.auth.user` 置 `null`，`nav-login` 立刻可见，但 `POST /api/v1/auth/logout` 的 `Set-Cookie` 尚未落盘，紧接着的路由访问仍会携带旧 cookie（或被稍后触发的 `location.assign('/')` 中止）。修复为 `auth.logout()` 先 `await api.logout()` 等待 cookie 清除完成；受保护页保持当前视图直至 `location.assign('/')` 完成首页加载，公开页则在 cookie 清除后就地更新状态而不整页跳转。
4. **Laravel + SQLite 的两个细节**：Laravel SQLite 连接配置显式加上 `'busy_timeout' => 5000` 与 `'transaction_mode' => 'IMMEDIATE'` 避免并发收藏升级写锁时报 `SQLITE_BUSY`；`CrossDb::dbTimestamp()` 在 SQLite 下改为 6 位微秒精度 UTC（`Y-m-d\TH:i:s.u+00:00`），避免同秒内与带微秒的种子/新建时间戳做文本比较时顺序错位。
5. **字体资产体积**：`@fontsource/noto-serif-sc` 包含完整中文字体子集（约 86 MB），不宜直接入库；通过 `scripts-sync-assets.sh` 在 `./build` 与 `./run` 时同步到被 `.gitignore` 忽略的 `public/fonts/` 与 `public/styles/`，既保持零运行时外链，也保持仓库轻盈。
