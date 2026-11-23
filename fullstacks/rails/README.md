# HelloTime Pro · Ruby on Rails 全栈（2.0）

Ruby 4.0、Rails 8.1 和 Active Record 共同承载 JSON API 与服务端渲染页面。Rails 控制器用 ERB 渲染广场、详情和个人中心，Turbo Drive 处理站内导航，Turbo Stream 回送封存回执，Stimulus 负责输码、倒计时、筛选和时间选择器。两套皮肤都使用 Rails 渲染的表单和仓库统一的设计令牌。

## 运行

需要 Ruby 4.0、Bundler、Node.js / npm，以及选择 PostgreSQL 时的本机 PostgreSQL。以下命令在仓库根目录执行。

```bash
(cd fullstacks/rails && ./build && ./test)
./scripts/db init
./scripts/hello start rails
./scripts/hello stop rails
```

启动后访问 <http://127.0.0.1:7181>。同源 API 前缀为 `/api/v1`，可用 `/api/v1/health` 查看版本和实际数据库驱动。默认使用 PostgreSQL。要用 SQLite，可指定同一个文件供建表和启动使用。

```bash
export DB_DRIVER=sqlite
export DB_URL="sqlite:///${PWD}/data/sqlite/hellotime-rails.db"
./scripts/db init
./scripts/hello start rails
```

表结构与演示数据由根目录的 `scripts/db` 管理。时笺所用的 @fontsource 字体由 Propshaft 同源提供。首次安装依赖时需要 Bundler 和 npm，浏览器运行时从 Rails 读取页面、样式与脚本。

## 页面与接口

| 路径 | 功能 |
|---|---|
| `/` | 广场、概览、精选胶囊、就地输码、字面搜索、筛选、排序和分页 |
| `/open` | 8 格输码与最近封存的胶囊 |
| `/capsules/:code` | 按码查看胶囊、实时倒计时、到点开启、收藏和分享 |
| `/create` | 预设、时笺标尺与日历、琥珀星轨时钟、AI 推荐与代笔、封存回执 |
| `/login`、`/register` | 邮箱登录、注册、头像选择和站内回跳 |
| `/me/created`、`/me/favorites`、`/me/profile` | 个人统计、胶囊管理、收藏、资料和密码 |
| `/about` | 项目功能、原则与当前 Rails 技术栈 |

`/api/v1/plaza/stats` 提供广场统计，数量跟随搜索，两个开启时刻覆盖整个广场。`/api/v1/me/stats` 返回当前用户的创建、开启、公开和收藏统计。可以收藏自己创建的、未公开的和未开启的胶囊。未公开胶囊仍可凭码查看。

接口与界面约定见 [OpenAPI](../../spec/api/openapi.yaml)、[界面测试钩子](../../spec/ui/testids.md) 和 [Rails 技术手册](TECHNICAL_GUIDE.md)。

## 2.0 验证

2026-11-23，验证使用独立的 PostgreSQL 库与 SQLite 文件。

| 驱动 | API 契约 | UI 冒烟（时笺 + 琥珀） |
|---|---:|---:|
| PostgreSQL | 117/117 | 88/88 |
| SQLite | 117/117 | 88/88 |

`./build`、Propshaft 资产预编译、设计令牌校验均通过。`./test` 的 6 个用例、34 条断言通过。另用 390px 视口验证标尺拖动、日历键盘操作、星轨表盘和换肤同步，并验证 AI 请求取消、封存提交锁与草稿版本清理。

PostgreSQL 并发验证跑了 4 轮。重复收藏只计一次，同时删除与取消收藏后，详情和统计保持一致。

契约会重置并播种 `DB_URL`，执行下列命令前须指向独立验证库。

```bash
./verification/scripts/verify-contract.sh rails
./verification/scripts/verify-ui-smoke.sh rails
./verification/scripts/verify-design-tokens.sh rails
```

### 广场卡片导航回归

启动 Rails 并准备至少一枚公开胶囊后，可使用共享 UI 验证的 Playwright 和 Chromium 运行卡片导航回归。用例覆盖两套皮肤下的首屏和搜索结果，从卡片点击验证顶层地址与详情内容。

```bash
node --test fullstacks/rails/script/plaza_navigation.cjs
```

### 双皮肤交互回归

2026-11-23 对齐 Rails 页面后，PostgreSQL 与 SQLite 的完整双皮肤 UI 冒烟各通过 88/88。最后补齐时笺标尺后，另复验创建、换肤、个人中心、公开页面与广场导航，并用正常动效跑下面的仪式回归。

这个测试保留正常动效，会创建验证账号和胶囊。将服务连到独立验证库后再执行。用例覆盖桌面换肤与发布状态同步、390px 时笺长按与盖印，以及两套皮肤在真实倒计时归零后的开启过程。

```bash
FRONTEND_URL=http://127.0.0.1:7181 node --test fullstacks/rails/script/skin_alignment.cjs
```

## 2.0 迁移笔记

- 网页详情统一为 `/capsules/:code`，登录回跳使用 `redirect`。网页保留 HttpOnly Cookie 和 Rails CSRF 校验，JSON 接口继续支持 Bearer JWT。
- 时笺和琥珀使用各自的 ERB 页面结构，共用服务端路由与 Stimulus 交互。创建页的表单状态可跨皮肤延续，服务端用 Turbo Stream 返回封存回执。首帧由本地偏好决定皮肤和明暗，Stimulus 控件在事件接好后启用。
- SQLite 的种子、旧 Rails 行和其他栈写出的行可能使用不同 UUID 表示。Active Record 将 UUID 读成统一格式并保留已有键的原始值，按码查询、收藏关系和删除可处理两种存储格式。
- SQLite 比较时间时会补齐 ISO 文本的小数秒。这样能正确区分同一秒内的整秒与小数秒。搜索用 SQLite 连接级 Unicode 小写函数和字面转义。
