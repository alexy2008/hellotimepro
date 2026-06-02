# 验证脚本覆盖说明

> 版本 0.1 · 2026-06-02 · 当前依据：`verification/scripts/verify-contract.sh`、`verification/scripts/verify-ui-smoke.sh`、`verification/contract/*.spec.ts`、`verification/ui/tests/*.spec.ts`。

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
3. 若使用 SQLite，按目标实现派生独立数据库文件，例如 `hellotime-fastapi.db`，避免多实现互相覆盖。
4. 停掉旧目标实例。
5. 执行 `./scripts/db reset --seed --yes`，显式重置 schema 并注入演示数据。
6. 执行 `./scripts/hello start <target>` 启动目标服务。
7. 最多 60 秒轮询 `GET /api/v1/health`。
8. 执行：

```bash
BASE_URL=<target-url> node --test verification/contract/*.spec.ts
```

9. 无论成功失败，都清理 `@hellotime-contract.com` 测试用户及其级联数据。
10. 执行 `./scripts/db seed --force` 重注入演示数据。
11. 通过 `trap` 停止目标服务。

### 1.3 当前覆盖总览

当前后端契约验证共 **104** 个用例。

| 测试文件 | 数量 | 覆盖项目 | 主要内容 |
|---|---:|---|---|
| `health.spec.ts` | 1 | 健康检查 | `GET /api/v1/health` 的 envelope、健康数据、stack 信息形状。 |
| `avatars.spec.ts` | 1 | 头像目录 | `GET /api/v1/avatars` 至少 10 项，字段完整。 |
| `auth.spec.ts` | 10 | 注册 / 登录 / refresh / logout | 注册成功 token 对与 user；重复邮箱、重复昵称、弱密码；登录成功、邮箱大小写不敏感、错误密码；refresh token 轮转与重用整族作废；logout 吊销 refresh token；logout 空 body 返回 204。 |
| `auth-errors.spec.ts` | 6 | 鉴权错误路径 | 受保护端点缺 token、非法 token、非 Bearer 前缀；非所有者删除 403；登录失败高频 429；所有错误响应符合 ErrorEnvelope。 |
| `me.spec.ts` | 8 | 当前用户资料 | `GET /me`；`PATCH /me` 更新昵称和头像、单字段更新、昵称冲突、非法 body；`POST /me/password` 当前密码错误、弱密码、成功后 204 且 refresh token 全族吊销。 |
| `capsules-create.spec.ts` | 10 | 胶囊创建和 code 查询 | 创建成功返回完整 `CapsuleDetail`；`openAt` 太近或超过 10 年、标题过长、正文过长、无 token；按 code 查询未开启胶囊隐藏正文；code 大小写不敏感、不存在 404、格式错误 422。 |
| `capsules-sealed.spec.ts` | 5 | 未开启胶囊语义 | 未开启详情 `content=null`、`isOpened=false`；公开胶囊出现在广场列表且列表不含正文；作者也不能提前预览正文；私密胶囊不进广场但 code 可访问；私密胶囊广场详情 404。 |
| `capsules-opened.spec.ts` | 4 | 开启状态和删除 | `isOpened` 在 byCode、广场详情、列表中都是 boolean；作者可删除未开启胶囊；非作者删除 403；不存在删除 404。 |
| `plaza.spec.ts` | 14 | 广场列表和详情 | 默认 `sort=new` 按 `createdAt DESC`；`sort=hot` 按 `favoriteCount DESC`；只返回 `inPlaza=true`；列表项形状不含 content，含 creator、isOpened、favoritedByMe；匿名 favoritedByMe 恒 false；分页上限和分页元数据；非法 filter/sort；标题和作者昵称 q 搜索；空白 q 视为未传；超长 q；广场详情返回 `CapsuleDetail`。 |
| `favorites.spec.ts` | 10 | 收藏业务 | 首次收藏返回 capsuleId、favoriteCount、favoritedAt；重复收藏幂等；取消收藏 204；未收藏取消仍 204；不能收藏自己的胶囊；未登录 401；不存在胶囊 404；私密胶囊 404；我的收藏按收藏时间倒序且含 favoritedAt；我的收藏未登录 401。 |
| `favorites-count.spec.ts` | 4 | `favoriteCount` 一致性 | 串行收藏 / 取消与实际行数一致；重复收藏 / 取消不累加；计数不为负；5 个账号并发收藏后总数仍准确。 |
| `me-capsules.spec.ts` | 4 | 我创建的胶囊 | `GET /me/capsules` 按创建时间倒序列出当前用户胶囊；未登录 401；分页生效；删除胶囊后级联删除收藏关系。 |
| `envelope.spec.ts` | 6 | 统一响应壳 | 成功响应 `success=true` 且有 data；失败响应 `success=false` 且 errorCode/message 非空；success 必须是 boolean；JSON Content-Type；204 无 body；校验错误可带 details 数组。 |
| `error-codes.spec.ts` | 9 | 错误码与 HTTP 映射 | `VALIDATION_ERROR=422`、`UNAUTHORIZED=401`、`FORBIDDEN=403`、`NOT_FOUND=404`、`CONFLICT=409`、`BAD_REQUEST=400`、`RATE_LIMITED=429`；所有错误码在允许枚举内；非法 openAt 返回 `VALIDATION_ERROR`。 |
| `capsule-suggestion.spec.ts` | 6 | AI 胶囊正文建议 | `POST /api/v1/capsule-suggestion` 带标题返回正文和开启建议；不传 title 或 title 为空时同时返回 title；title 超长 422；locale 任意仍 200；连续请求 `cached=false`。 |
| `capsule-recommendations.spec.ts` | 6 | AI 推荐主题 | `GET /api/v1/capsule-recommendations` 默认返回 items 数组且最多 8 项；`count=3` 限制数量；`count=20` 和 `count=2` 越界 422；返回标题互不相同；`cached=false`。 |

### 1.4 最近全栈验收记录

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
| `next` | `next` |
| `nuxt` | `nuxt` |

- `react`、`vue`、`angular`、`svelte` 是纯前端实现，默认通过 `BACKEND_PROXY=http://127.0.0.1:9080` 访问后端。
- `next`、`nuxt` 是全栈同源实现，脚本直接启动自身 API + UI。
- Playwright 只跑 Chromium，视口为 `1280x800`，`workers=1`，`retries=0`，单测超时 30 秒。
- 失败时 HTML 报告位于 `verification/ui/report/index.html`。

### 2.2 执行流程

1. 将目录别名映射为 `hello list` 登记名，例如 `react-ts -> react`。
2. 检查 `node`；若 `verification/ui/node_modules` 不存在，则安装 Playwright 依赖和 Chromium。
3. 从 `./scripts/hello list` 获取目标前端端口，拼出 `FRONTEND_URL`。
4. 从 `data/.hello-state.json` 读取数据库配置，用于初始化 schema 和后续清理测试数据。
5. 执行 `./scripts/db init` 确保 schema 已初始化。注意：UI 脚本只 init，不 reset，不 seed。
6. 启动目标：
   - 纯前端：`BACKEND_PROXY=<proxy-url> ./scripts/hello start <target>`。
   - 全栈：`./scripts/hello start <target>`。
7. 最多 30 秒轮询目标首页。
8. 执行：

```bash
FRONTEND_TARGET=<target> FRONTEND_URL=<frontend-url> \
  npx --prefix verification/ui playwright test \
  --config verification/ui/playwright.config.ts
```

9. 无论成功失败，都清理 `@ui-smoke.hellotimepro.dev` 测试用户及其级联数据。
10. 通过 `trap` 停止目标前端或全栈服务。

### 2.3 当前覆盖总览

当前前端 UI 冒烟验证共 **25** 个 Playwright 用例。

| 测试文件 | 数量 | 覆盖项目 | 主要内容 |
|---|---:|---|---|
| `smoke.spec.ts` | 4 | 公开页 / 路由守卫 / 会话保持 | 主页面、开启页、关于页可渲染；注册页头像选择器从后端加载 10 个头像；匿名访问 `/create`、`/me/favorites` 跳转登录；登录后访问注册页不会破坏当前会话。 |
| `auth.spec.ts` | 4 | 注册登录流程 | 用户通过 UI 注册并进入创建页；API 预置账号可通过 UI 登录；错误密码停留登录页并显示错误；登出后访问受保护页跳转登录。 |
| `capsules.spec.ts` | 9 | 胶囊创建 / 开启 / 我的列表 / AI 创建辅助 | UI 创建胶囊后可在广场按标题检索到；开启页输入 8 位码跳转详情；未开启详情隐藏正文并显示未开启；我创建的列表包含当前用户创建的胶囊；创建页异步加载 AI 推荐主题；AI 推荐为空时静默不显示推荐区；点击推荐主题填入标题和正文；空标题直接 AI 生成标题和正文并可提交；推荐区“换一批”按钮可用且不报错。 |
| `plaza.spec.ts` | 4 | 广场搜索和收藏 | 广场按标题搜索过滤列表；已登录用户在广场收藏后出现在“我收藏的”；匿名点击收藏弹确认并跳转登录；“我收藏的”页面展示 API 预置收藏。 |
| `me.spec.ts` | 4 | 个人中心 | 资料页修改昵称并同步到用户菜单；无改动保存显示提示；修改密码两次新密码不一致由前端拦截；个人中心导航可在“我创建的”和“我收藏的”间切换。 |

### 2.4 测试数据和隔离方式

- UI helper 通过 API 创建测试用户、胶囊和收藏关系，邮箱域固定为 `@ui-smoke.hellotimepro.dev`。
- 每个测试使用随机邮箱、昵称、标题，避免依赖执行顺序。
- Playwright 每个用例隔离浏览器状态，登录状态通过 UI 流程或 helper 建立。
- AI 推荐 / AI 建议相关 UI 用例使用 Playwright route mock 固定接口响应，避免真实 LLM 可用性影响前端冒烟稳定性；胶囊最终创建仍走真实 API。

---

## 3. 不属于当前两套主验证的脚本

`verification/scripts/verify-design-tokens.sh` 目前是 M0 占位脚本，只输出设计令牌一致性提示并 `exit 0`。它不检查后端契约，也不运行前端 UI 冒烟用例。
