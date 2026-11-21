# 验证脚本覆盖说明

> 2.0 · 2026-11-21（按当前源码静态盘点） · 当前依据：`verification/scripts/verify-contract.sh`、`verification/scripts/verify-ui-smoke.sh`、`verification/contract/*.spec.ts`、`verification/ui/tests/*.spec.ts`。

本文整理当前后端契约验证和前端 UI 冒烟验证的入口、执行流程、数据处理方式，以及实际覆盖的测试项目。

---

## 1. 后端契约验证

### 1.1 入口命令

```bash
./verification/scripts/verify-contract.sh <target>

# 常用示例
./verification/scripts/verify-contract.sh fastapi
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh fastapi
./verification/scripts/verify-contract.sh next
DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nuxt
```

- `target` 来自 `./scripts/hello list` 的登记名。
- 脚本通过目标服务自己的端口直连 `/api/v1/*`，并把 `BASE_URL` 传给 Node 原生测试。
- 该脚本同时适用于后端和全栈实现；全栈实现只要在自身端口提供完整 API 即可，不需要经过 `:9080` 代理。
- PostgreSQL 是默认数据库；设置 `DB_DRIVER=sqlite` 时切换到 per-impl SQLite 文件。
- 契约测试是黑盒测试，只通过 HTTP 和统一 envelope 断言行为，不读取数据库，不导入实现代码。

### 1.2 执行流程

1. 读取 `./scripts/hello list`，确认目标端口，拼出 `http://127.0.0.1:<port>`。
2. 从 `data/.hello-state.json` 读取数据库配置；环境变量优先于 state 文件。
3. 若使用 SQLite 且未指定 `DB_URL`，按目标实现派生独立数据库文件，例如 `hellotime-fastapi.db`，避免多实现互相覆盖。
4. 停掉旧目标实例。启动、清理和补种沿用步骤 2–3 解析出的同一连接。维护工具将 `postgres://`、`postgresql://` 统一为 SQLAlchemy 的 `postgresql+psycopg://`，保留地址、库名和查询参数。
5. 执行 `./scripts/db reset --seed --yes`，显式重置 schema 并注入演示数据。
6. 执行 `./scripts/hello start <target>` 启动目标服务。
7. 最多 60 秒轮询 `GET /api/v1/health`。
8. 执行：

```bash
BASE_URL=<target-url> node --test verification/contract/*.spec.ts
```

9. 测试退出后，`db cleanup-contract` 在同一数据库清理 `@hellotime-contract.com` 测试用户及其级联数据。
10. 执行 `./scripts/db seed --force` 重注入演示数据。
11. 通过 `trap` 停止目标服务。

### 1.3 当前覆盖总览

当前契约源码声明 **117** 个用例。该数量表示覆盖范围。

| 测试文件 | 数量 | 覆盖项目 | 主要内容 |
|---|---:|---|---|
| `health.spec.ts` | 1 | 健康检查 | `GET /api/v1/health` 的 envelope、健康数据、stack 信息形状。 |
| `avatars.spec.ts` | 1 | 头像目录 | `GET /api/v1/avatars` 至少 10 项，字段完整。 |
| `auth.spec.ts` | 10 | 注册 / 登录 / refresh / logout | 注册成功 token 对与 user；重复邮箱、重复昵称、弱密码；登录成功、邮箱大小写不敏感、错误密码；refresh token 轮转与重用整族作废；logout 吊销 refresh token；logout 空 body 返回 204。 |
| `auth-errors.spec.ts` | 6 | 鉴权错误路径 | 受保护端点缺 token、非法 token、非 Bearer 前缀；非所有者删除 403；登录失败高频 429；所有错误响应符合 ErrorEnvelope。 |
| `me.spec.ts` | 8 | 当前用户资料 | `GET /me`；`PATCH /me` 更新昵称和头像、单字段更新、昵称冲突、非法 body；`POST /me/password` 当前密码错误、弱密码、成功后 204 且 refresh token 全族吊销。 |
| `capsules-create.spec.ts` | 11 | 胶囊创建和 code 查询 | 创建成功返回完整 `CapsuleDetail`；`openAt` 太近或超过 10 年、标题过长、正文过长、无 token；按 code 查询未开启胶囊隐藏正文；code 大小写不敏感、不存在 404、格式错误 422。 |
| `capsules-sealed.spec.ts` | 5 | 未开启胶囊语义 | 未开启详情 `content=null`、`isOpened=false`；公开胶囊出现在广场列表且列表不含正文；作者也不能提前预览正文；私密胶囊不进广场但 code 可访问；私密胶囊广场详情 404。 |
| `capsules-opened.spec.ts` | 4 | 开启状态和删除 | `isOpened` 在 byCode、广场详情、列表中都是 boolean；作者可删除未开启胶囊；非作者删除 403；不存在删除 404。 |
| `plaza.spec.ts` | 14 | 广场列表和详情 | 默认 `sort=new` 按 `createdAt DESC`；`sort=hot` 按 `favoriteCount DESC`；只返回 `inPlaza=true`；列表项形状不含 content，含 creator、isOpened、favoritedByMe；匿名 favoritedByMe 恒 false；分页上限和分页元数据；非法 filter/sort；标题和作者昵称 q 搜索；空白 q 视为未传；超长 q；广场详情返回 `CapsuleDetail`。 |
| `favorites.spec.ts` | 11 | 收藏业务 | 首次收藏返回 capsuleId、favoriteCount、favoritedAt；重复收藏幂等；取消收藏 204；未收藏取消仍 204；可以收藏自己的胶囊；未登录 401；不存在胶囊 404；可以收藏通过胶囊码取得的私密胶囊；非法 UUID 返回 422；我的收藏按收藏时间倒序且含 favoritedAt；我的收藏未登录 401。 |
| `favorites-count.spec.ts` | 4 | `favoriteCount` 一致性 | 串行收藏 / 取消与实际行数一致；重复收藏 / 取消不累加；计数不为负；5 个账号并发收藏后总数仍准确。 |
| `me-capsules.spec.ts` | 5 | 我创建的胶囊 | `GET /me/capsules` 按创建时间倒序列出当前用户胶囊；未登录 401；分页生效；删除胶囊后级联删除收藏关系。 |
| `envelope.spec.ts` | 6 | 统一响应壳 | 成功响应 `success=true` 且有 data；失败响应 `success=false` 且 errorCode/message 非空；success 必须是 boolean；JSON Content-Type；204 无 body；校验错误可带 details 数组。 |
| `error-codes.spec.ts` | 8 | 错误码与 HTTP 映射 | `VALIDATION_ERROR=422`、`UNAUTHORIZED=401`、`FORBIDDEN=403`、`NOT_FOUND=404`、`CONFLICT=409`、`RATE_LIMITED=429`；所有错误码在允许枚举内；非法 openAt 返回 `VALIDATION_ERROR`。 |
| `capsule-suggestion.spec.ts` | 6 | AI 胶囊正文建议 | `POST /api/v1/capsule-suggestion` 带标题返回正文和开启建议；不传 title 或 title 为空时同时返回 title；title 超长 422；locale 任意仍 200；连续请求 `cached=false`。 |
| `capsule-recommendations.spec.ts` | 6 | AI 推荐主题 | `GET /api/v1/capsule-recommendations` 默认返回 items 数组且最多 8 项；`count=3` 限制数量；`count=20` 和 `count=2` 越界 422；返回标题互不相同；`cached=false`。 |
| `stats.spec.ts` | 11 | 广场与个人统计 | 校验筛选计数与列表总数、开启时间、删除后的个人统计，以及搜索词中 `%` 和 `_` 的字面匹配。 |

### 1.4 历史记录（1.x 全栈验收）

2026-06-02 复跑 next / nuxt 双数据库契约验证，结果全部通过：

| target | 数据库 | 命令 | 结果 |
|---|---|---|---|
| `next` | PostgreSQL | `./verification/scripts/verify-contract.sh next` | 104/104 通过 |
| `next` | SQLite | `DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh next` | 104/104 通过 |
| `nuxt` | PostgreSQL | `./verification/scripts/verify-contract.sh nuxt` | 104/104 通过 |
| `nuxt` | SQLite | `DB_DRIVER=sqlite ./verification/scripts/verify-contract.sh nuxt` | 104/104 通过 |

本轮修复了两个全栈实现的公开 AI 建议端点误鉴权问题，并将两者的 `better-sqlite3` 升级到支持 Node 26 的版本，恢复 SQLite 验证启动。

---

## 2. 前端 UI 冒烟验证

### 2.1 入口命令

```bash
./verification/scripts/verify-ui-smoke.sh <frontend>

# 常用示例
./verification/scripts/verify-ui-smoke.sh react-ts
./verification/scripts/verify-ui-smoke.sh vue3-ts
./verification/scripts/verify-ui-smoke.sh angular
./verification/scripts/verify-ui-smoke.sh svelte-ts
./verification/scripts/verify-ui-smoke.sh next
./verification/scripts/verify-ui-smoke.sh nuxt
```

支持的参数：

| 输入 | 实际 target |
|---|---|
| `react` / `react-ts` | `react` |
| `vue` / `vue3-ts` | `vue` |
| `angular` | `angular` |
| `svelte` / `svelte-ts` | `svelte` |
| `solid` / `solid-ts` | `solid` |
| `next` | `next` |
| `nuxt` | `nuxt` |
| `spring-mvc` / `rails` / `laravel` | 同名 target |

- `react`、`vue`、`angular`、`svelte`、`solid` 是纯前端实现，默认通过 `BACKEND_PROXY=http://127.0.0.1:9080` 访问后端。
- `next`、`nuxt`、`spring-mvc`、`rails`、`laravel` 是全栈同源实现，脚本直接启动自身 API + UI。
- Playwright 只跑 Chromium，视口为 `1280x800`，`workers=1`，`retries=0`，默认单例超时 40 秒。
- 失败时 HTML 报告位于 `verification/ui/report/index.html`。

### 2.2 执行流程

1. 将目录别名映射为 `hello list` 登记名，例如 `react-ts -> react`。
2. 检查 `node`；若 `verification/ui/node_modules` 不存在，则安装 Playwright 依赖和 Chromium。
3. 从 `./scripts/hello list` 获取目标前端端口，拼出 `FRONTEND_URL`。
4. 统一解析 `DB_DRIVER` 与 `DB_URL`。纯前端读取代理后端 `/api/v1/health` 的数据库项核对驱动，默认 SQLite 文件按代理目标命名，直连本机登记端口时按该端口的实现名派生；自定义库须在两端传入同一 `DB_URL`。全栈按自身服务名选择默认文件。
5. 执行 `./scripts/db init` 确保 schema 已初始化。注意：UI 脚本只 init，不 reset，不 seed。
6. 启动目标：
   - 纯前端：`BACKEND_PROXY=<proxy-url> ./scripts/hello start <target>`。
   - 全栈：`./scripts/hello start <target>`。
7. 默认最多 120 秒轮询目标首页，可通过 `UI_READY_TIMEOUT` 调整。
8. 执行：

```bash
FRONTEND_TARGET=<target> FRONTEND_URL=<frontend-url> \
  npx --prefix verification/ui playwright test \
  --config verification/ui/playwright.config.ts
```

9. 测试退出后，`db cleanup-ui` 在步骤 4 确定的库中清理 `@ui-smoke.hellotimepro.dev` 测试用户及其级联数据。
10. 通过 `trap` 停止目标前端或全栈服务。

### 2.3 当前覆盖总览

当前 UI 源码声明 **44** 个用例。默认分别以 `paper`、`amber` 为初始皮肤运行，共 **88** 个执行项。

| 测试文件 | 数量 | 覆盖范围 |
|---|---:|---|
| `smoke.spec.ts` | 9 | 公开页、匿名路由守卫、未匹配路由、皮肤初始化、跨皮肤保留草稿和注册表单、昵称从格式错误改为有效 Unicode 输入。 |
| `auth.spec.ts` | 5 | 注册、登录、错误密码、登出和站内回跳。 |
| `capsules.spec.ts` | 15 | 封存校验与回执、私密胶囊、首页与开启页输码、输入半码后换肤、详情与倒计时、AI 推荐与代笔、换账号清草稿。 |
| `plaza.spec.ts` | 8 | 搜索与筛选计数、到点启封、热度排序、广场概览、收藏及匿名确认。 |
| `me.spec.ts` | 7 | 删除与取消收藏后的计数更新、资料与密码、个人页签、删除已显示记录后加载其余全部并收起“加载更多”。 |

### 2.4 测试数据和隔离方式

- UI helper 通过 API 创建测试用户、胶囊和收藏关系，邮箱域固定为 `@ui-smoke.hellotimepro.dev`。
- 每个测试使用随机邮箱、昵称、标题，避免依赖执行顺序。
- Playwright 每个用例隔离浏览器状态，登录状态通过 UI 流程或 helper 建立。
- AI 推荐 / AI 建议相关 UI 用例使用 Playwright route mock 固定接口响应，避免真实 LLM 可用性影响前端冒烟稳定性；胶囊最终创建仍走真实 API。

---

## 3. 不属于当前两套主验证的脚本

`verification/scripts/verify-design-tokens.sh [实现…]`（2.0 起正式实现）做静态的设计令牌检查：spec 两套皮肤语义令牌同名同集合、`spec/tokens/skins.json` 最新；给出实现时分别查 `base.css`、`paper/tokens.css`、`amber/tokens.css` 的导入或样式链接、自己的样式是否只用 `base.css` 刻度与语义令牌、有没有色值字面量。规则见 `docs/02-design.md §15.4`。它不检查后端契约，也不运行 UI 冒烟。
