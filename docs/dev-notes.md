# Dev Notes — 跨栈踩坑记录

本文件汇总了开发过程中各栈的已知坑、解决方案与约定，供所有 AI agent（Claude / Codex / Gemini）参考。
单次修复成本高、容易重踩的经验都记在这里，不分散到各实现目录。

> 更新规则：发现新坑后，直接在相应章节追加；带上发现日期和对应栈。

---

## 1. 项目质量策略

HelloTime Pro 以**教学 / 演示**为目的，以下类别问题不作为修复优先项，不要列为阻塞项或主动提出修复建议：

- JWT secret 默认值未强制校验
- 错误信息可能泄漏内部细节
- CORS `allow_origins=*`
- refresh token 存 localStorage
- 内存限流在多 worker 下失效
- Gin 并发锁不如 FastAPI 彻底（favorite / refresh 事务）
- 前端 401 恢复链的边缘情况

专注于各栈的惯用模式和 API 合约一致性即可。

---

## 2. 本地 PostgreSQL

**本机已装原生 EDB PostgreSQL 16，不要尝试启 Docker。**

| 配置项 | 值 |
|---|---|
| host | `127.0.0.1` |
| port | `5432`（注意：**不是** 55432） |
| database | `hellotime_pro` |
| user | `postgres` |
| password | 见 `data/.hello-state.json` |

`psql` 不在 PATH，完整路径为 `/Library/PostgreSQL/16/bin/psql`。

```bash
PGPASSWORD=<pw> /Library/PostgreSQL/16/bin/psql \
  -h 127.0.0.1 -p 5432 -U postgres -d hellotime_pro -c "SELECT ..."
```

- `./scripts/hello start <name>` 会自动从 `data/.hello-state.json` 读取并注入 `DB_URL`。
- 需要手动重建数据库：`DROP DATABASE` + `CREATE DATABASE`（不要 `docker compose down -v`）。
- `data/.hello-state.json` 由 hello web UI（`:9090`）维护；直接编辑也可以，确保 JSON 合法。

---

## 3. LLM 集成经验

参考实现：`backends/fastapi/app/services/llm_client.py`。

### 3.1 调用日志规范

每个后端 LLM 客户端模块必须在三个时机写结构化日志：

| 时机 | 级别 | 必含字段 |
|---|---|---|
| 请求发出前 | INFO | `model=`, `url=`, `attempt=N/M` |
| 响应成功 | INFO | `model=`, `elapsed_ms=`, `tokens=`（拿不到写 n/a） |
| 请求失败 | WARNING | `model=`, `elapsed_ms=`, `status=`（HTTP）或 `error=`（网络） |

前缀固定 `LLM request` / `LLM response` / `LLM error`，便于 `grep "LLM "` 过滤。

### 3.2 日志级别坑

框架默认 root logger 往往是 WARNING，应用自己的 INFO 日志会被吞，
表现为"代码写了日志却只看到失败、看不到成功"。

- **FastAPI/uvicorn**：uvicorn 只配自己的 `uvicorn.*` logger，不给 root 挂 handler。
  解决：`app/main.py:_configure_logging()` 给 `app` 命名空间单独挂 INFO StreamHandler，
  `propagate=False`，级别由 `LOG_LEVEL` 控制。
- 其它栈移植时，先确认应用日志级别确实是 INFO 且有输出目的地。

### 3.3 网关不稳定 → 必须重试

用户配置的网关（如 `opencode.ai/zen` DeepSeek）会**随机** SSL UNEXPECTED_EOF 掐断连接，
单次成功率约 50%。

- 在最底层 POST 处对**瞬时**错误（URLError / TimeoutError / OSError，含 SSL EOF）重试；
  HTTP 4xx/5xx 和坏 JSON **不重试**（非瞬时错误）。
- 默认：`LLM_MAX_RETRIES=2` + `LLM_RETRY_BACKOFF_MS=400`（线性退避）。
- 失败约 3–4 s 就返回（不等满超时），两次重试最坏约 13 s，成功率提到 ~87%。

### 3.4 Cloudflare error 1010

urllib 默认 UA 会被网关 Bot 防护封禁（HTTP 403, error_code 1010）。
解决：请求头带浏览器风格 `User-Agent`（可用 `LLM_USER_AGENT` 覆盖）。

### 3.5 调用风格 llm_api_style

多数兼容网关只支持 `/chat/completions`，不支持 `/responses`。
默认 `LLM_API_STYLE=chat` 直接走 chat，跳过 `/responses`（省一次请求、避免死端点挂超时）。
另有 `responses` / `auto`（先 responses 失败再回退 chat）两档可选。
本应用生成任务不需要推理，chat payload 固定 `thinking: {type: disabled}` 提速。

### 3.6 全栈用生产构建启动（next / nuxt）

next 的 `run` 脚本改为 `next build` + `next start`（而非 `next dev`）。
原因：`dev` 懒编译在 Playwright 下首次访问各路由时现场编译，本机负载下撞穿导航超时（4.5–7.4 min）。
生产构建预编译全部路由，整轮 smoke 约 14 s 稳定。nuxt 一直是生产构建。
热重载开发时仍用 `npm run dev`；`run` 脚本是给 hello CLI 和 smoke harness 用的。

### 3.7 整页 reload 序列误登出（next / nuxt）

**症状**：登录后整页导航序列（如 `/register → /`）回首页后用户态 chip 消失。

**根因**：启动时**急切拉取 `/me`**（next 的 `hydrate()` 调 `api.me()`；nuxt bootstrap 调 `refreshMe()`）
触发 refresh token 轮换。上一页轮换并吊销了 RT，但响应未及持久化就被下一次导航打断，
下一页用旧 RT 再刷新触发**重用检测 → 整族吊销 → `onAuthLost` 清空 user → chip 消失**。

**修复**：登录态由持久化的 `user`（zustand persist / Pinia store）渲染，
`hydrate()` 仅置 `isHydrated` 标志；token 改由真正的 authed 请求惰性刷新。

参考：`fullstacks/next/src/stores/auth-store.ts` / `fullstacks/nuxt/plugins/bootstrap.client.ts`。

### 3.8 React StrictMode 双触发（前端）

开发模式下 `<StrictMode>` 让 `useEffect` 跑两遍（mount→effect→cleanup→effect），
导致首屏副作用（如拉取推荐）发两次请求。**生产构建不会**。

- 轻量解法：`useRef` 闸门——effect 里 `if (inited.current) return; inited.current = true;`，只发一次。
  参考 `frontends/react-ts/src/pages/CreatePage.tsx` 的 `recoInited`。
- 推荐区"空列表不覆盖已有数据"：LLM 失败返回空数组时，前端保留现有 chip，避免把已显示内容闪没。

---

## 4. Svelte 特有坑（frontends/svelte）

### 4.1 `.svelte.ts` 单例必须带 `.ts` 后缀导入

```ts
// ✅ 正确
import { authStore } from "@/stores/auth.svelte.ts";

// ❌ 错误：跨组件变成两个不同实例
import { authStore } from "@/stores/auth.svelte";
```

不带 `.ts` 时，Vite + `@sveltejs/vite-plugin-svelte` 会把 `auth.svelte` 同时按两条链解析
（一次当 SFC、一次当 TS 模块），导致模块被加载两次、得到两个独立实例。表现：hydrate 写入
A 实例，AppHeader 订阅的是 B 实例，永远拿不到登录态；console 不报错，像"reactivity 不工作"。

本项目 `tsconfig` 已开 `allowImportingTsExtensions: true`，类型层无需额外配置。

### 4.2 svelte-routing 不能嵌套 Route

`svelte-routing@2.13` + Svelte 5 下，**不要在父 Route 的内容里嵌套子 Route**。
即便父用 `path="/*"` 通配，子 Route 挂载也会引发 `effect_update_depth_exceeded`，
页面只渲染到布局壳就停住。

正确写法：每条路径作为顶层 `<Route>`，layout 当普通组件多写几遍：

```svelte
<Router>
  <Route path="/"><MainLayout><PlazaPage /></MainLayout></Route>
  <Route path="/create"><MainLayout><AuthGate><CreatePage /></AuthGate></MainLayout></Route>
  <Route><MainLayout><NotFoundPage /></MainLayout></Route>
</Router>
```

另外 `svelte.config.js` **不要全局开** `compilerOptions.runes: true`，否则 svelte-routing 内部的
`Link.svelte`（用了 legacy `$$restProps`）会构建失败。Svelte 5 按文件自动识别 runes 模式。

---

## 5. Spring Boot 跨库 UUID / 时间戳映射

### 5.1 背景

spec schema 给 SQLite 和 Postgres 用不同存储格式：

| 字段类型 | SQLite | Postgres |
|---|---|---|
| UUID（id） | 32 位无横线 hex TEXT | 原生 `uuid` |
| 时间戳 | ISO-8601 TEXT，`+00:00` 偏移，无小数秒 | 原生 `timestamptz` |

Spring 实体映射若用 `@JdbcTypeCode(VARCHAR)` 或 OffsetDateTime↔Timestamp 转换器，
会破坏 Postgres 原生类型（`operator does not exist: uuid = character varying`）；
sqlite-jdbc 的 `getTimestamp` 解析不了带 `T`/偏移的 ISO 串（读成 null）。

### 5.2 解法

在实体字段上用自实现的 `@JdbcType` 注解，运行时按方言分流：

```java
@JdbcType(CrossDbUuidJdbcType.class)          // id 字段
@JdbcType(CrossDbOffsetDateTimeJdbcType.class) // 时间戳字段
```

- SQLite 路径：`getString` / `setString`，UUID 兼容带/不带横线，时间戳写出格式与 seed 一致。
- Postgres 路径：`setObject` / `getObject(UUID.class | OffsetDateTime.class)`。
- **必须自实现 `ValueBinder`**（不用 `BasicBinder`）：null 也要按方言 `setNull`，
  否则 Postgres 会把 VARCHAR null 写入 `timestamptz` 报错。

实现位置：`backends/spring-boot/src/main/java/.../db/`。

### 5.3 注意事项

- **改 spec schema / seed / db 脚本后，spring 是最脆的**，必须双驱动复验 `verify-contract.sh spring`。
- SQLite 外键 cascade 默认关；手动只 `seed --force` 不 reset 会残留旧测试数据干扰排查。
- `run` 脚本 SQLite URL 不需要 `?date_class=TEXT`（已走 `getString/setString`）。
- 验收：2026-06-02 双驱动各 `verify-contract.sh spring` **104/104**。
