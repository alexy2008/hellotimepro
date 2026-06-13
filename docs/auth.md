# HelloTime Pro · 鉴权全流程

> 本文是 20 个实现共同遵守的鉴权契约的「权威叙述版」。规范事实源是 [`spec/api/openapi.yaml`](../spec/api/openapi.yaml)（端点 / 错误码）与 [`docs/02-design.md`](02-design.md) §7（策略）；参考实现是 [`backends/fastapi/app/services/auth_service.py`](../backends/fastapi/app/services/auth_service.py) 与 [`app/core/security.py`](../backends/fastapi/app/core/security.py)。
>
> 所有后端的鉴权行为都由 104 条黑盒契约用例约束，本文描述的每一条规则都有对应用例。

---

## 1. 设计目标

| 目标 | 手段 |
|---|---|
| 无状态校验请求 | access token 用 JWT（HS256），服务端不查库即可验签 |
| 可吊销、可登出 | refresh token 落库（存 hash），可单条或整族吊销 |
| 被盗用可检测 | refresh token 轮转（rotate）+ 家族（family）追踪，重放即整族作废 |
| 改密后旧会话失效 | 改密吊销该用户全部 refresh token |
| 跨 20 栈一致 | 同一份 OpenAPI 契约 + 同一组黑盒用例，内部实现自由 |

---

## 2. 两种令牌

```
┌──────────────────────────────────────────────────────────────┐
│ access token                                                   │
│  · JWT，算法 HS256，密钥 JWT_SECRET                            │
│  · 有效期 1 小时（3600s）                                      │
│  · payload: { sub=user_id, nickname, avatarId, iat, exp }      │
│  · 无状态：服务端只验签 + 查过期，不落库                       │
│  · 随每个受保护请求带在 Authorization: Bearer <token>          │
├──────────────────────────────────────────────────────────────┤
│ refresh token                                                  │
│  · 不透明随机串：256-bit，base64url 编码                       │
│  · 有效期 7 天（604800s）                                      │
│  · 落库：只存 sha256(token)，明文从不入库                      │
│  · 每条带 family_id；轮转时延续同一 family                     │
└──────────────────────────────────────────────────────────────┘
```

**为什么 access 用 JWT、refresh 用不透明串？**
access token 要在每个请求上高频校验，无状态 JWT 避免每请求查库；refresh token 低频使用、必须可吊销，所以落库并支持 rotate / 整族撤销。明文 refresh token 从不落库——库里只有 sha256 hash，即使库泄露也无法直接当令牌用（参考 [`security.py:hash_refresh_token`](../backends/fastapi/app/core/security.py)）。

**密码存储**：bcrypt（参考实现 rounds 可配），明文密码从不落库。

---

## 3. 端点一览

| 方法 | 路径 | 鉴权 | 行为 |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 公开 | 注册并直接返回令牌对 |
| POST | `/api/v1/auth/login` | 公开 | 校验密码，返回令牌对 |
| POST | `/api/v1/auth/refresh` | 公开¹ | 消耗一个 refresh token，轮转出新令牌对 |
| POST | `/api/v1/auth/logout` | 公开¹ | 吊销提供的 refresh token（幂等） |
| GET | `/api/v1/me` | Bearer | 当前用户资料 |
| PATCH | `/api/v1/me` | Bearer | 改昵称 / 头像 |
| POST | `/api/v1/me/password` | Bearer | 改密码，吊销其他 refresh token |

> ¹ `refresh` / `logout` 在 OpenAPI 里 `security: []`：它们不靠 access token 鉴权，而是靠请求体里的 refresh token 自证身份。

成功返回的令牌对（`AuthTokens`）：

```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<不透明串>",
  "accessTokenExpiresIn": 3600,
  "refreshTokenExpiresIn": 604800,
  "user": { "id": "...", "email": "...", "nickname": "...", "avatarId": "...", "createdAt": "..." }
}
```

---

## 4. 注册 / 登录流程

```
注册 register                          登录 login
─────────────────                      ─────────────────
1. 校验 avatarId 合法                   1. email 归一化（lower+trim）
2. email 归一化（lower+trim）           2. 登录失败限流检查（按 email，60s 窗口）
3. 预检 email / nickname 冲突           3. 查 user
4. bcrypt 哈希密码，建 user             4. bcrypt 校验密码
5. 并发兜底：DB unique 约束             ├─ 失败 → 记一次失败 → 401
   命中冲突 → 409 CONFLICT              │           "邮箱或密码错误"
6. 签发令牌对（新 family）              5. 签发令牌对（新 family）
7. 提交事务 → 返回 AuthTokens           6. 提交事务 → 返回 AuthTokens
```

要点：
- **email 大小写不敏感唯一**（存储统一小写）；**nickname 大小写敏感唯一**。
- 注册冲突字段精确化：`{ errorCode: "CONFLICT", field: "email" | "nickname" }`。预检给出友好提示，并发下仍由 DB unique 索引兜底（捕获 `IntegrityError` 再按错误信息判定字段）。
- 登录失败不区分「邮箱不存在」与「密码错误」，统一 `UNAUTHORIZED`，避免账号枚举。
- 参考实现带一个**内存登录限流**（按 email、60s 滑动窗口，超阈值 `RATE_LIMITED`）；其它栈可选实现，非契约硬约束。

---

## 5. Refresh 轮转 + 家族追踪（核心）

这是整套鉴权里最精巧的部分，也是 review 里反复出现的并发坑所在。

### 5.1 正常轮转

```
客户端持有 RT₁(family=F)
        │
        ▼  POST /auth/refresh { refreshToken: RT₁ }
┌────────────────────────────────────────────────┐
│ 1. hash(RT₁) 查行 row                            │
│    （Postgres 上加 SELECT ... FOR UPDATE 行锁）  │
│ 2. row 不存在        → 401 "无效"                │
│ 3. row.expires_at 过期 → 401 "已过期"            │
│ 4. row.revoked_at 非空 → 重放！见 5.2            │
│ 5. 校验 user 存在                                │
│ 6. row.revoked_at = now（吊销旧的）              │
│ 7. 签发新 RT₂，family = F（延续！）              │
│ 8. 提交事务                                      │
└────────────────────────────────────────────────┘
        │
        ▼  返回 { accessToken, refreshToken: RT₂, ... }
客户端持有 RT₂(family=F)，RT₁ 已作废
```

每次 refresh 都是「**作废旧的、签发新的、家族不变**」。同一登录会话的所有 refresh token 共享一个 `family_id`，形成一条轮转链：`RT₁ → RT₂ → RT₃ → …`。

### 5.2 重放检测 → 整族作废

如果攻击者偷到了 `RT₁` 并抢先用掉，合法用户后续再拿 `RT₁`（已 revoked）来刷新就会命中第 4 步：

```
                         RT₁ 被盗
                            │
   合法用户 ──RT₁──► refresh ──► 拿到 RT₂（此刻 RT₁ 已 revoked）
   攻击者   ──RT₁──► refresh ──► row.revoked_at 非空！
                            │
                            ▼
            ┌─────────────────────────────────────┐
            │ 把 family=F 下所有未撤销的 RT 全部   │
            │ revoked_at = now  →  整族作废         │
            └─────────────────────────────────────┘
                            │
                            ▼
        合法用户的 RT₂ 也失效 → 双方都被踢下线
        → 用户被迫重新登录（开启新 family）
```

「一个 refresh token 被用了两次」是被盗用的强信号。代价是合法用户也被登出一次，但换来的是攻击者无法靠偷来的旧 token 维持长期访问。这正是 `refresh_tokens` 表保留 `family_id` + `revoked_at` 两列的理由。

### 5.3 并发坑（来自跨栈 review）

轮转的「查 → 校验 → 吊销旧 → 插新」四步必须串行一致，否则两个并发 refresh 请求可能都读到未吊销的同一行、各自签发新 token，使一条链分叉。各栈的处理：

| 策略 | 代表实现 |
|---|---|
| `SELECT ... FOR UPDATE` 行锁（Postgres）| fastapi、spring-boot、多数 ORM 栈 |
| `UPDATE ... WHERE revoked_at IS NULL RETURNING` 原子吊销 | 推荐的无锁写法 |
| 连接池上限 1 / actor 串行化（SQLite）| axum（池=1）、vapor（actor） |
| 教学项目「非事务 + TODO 注释」 | 部分全栈（按[质量策略](../.claude/projects/-Users-alex-AiWork-HelloTimeProByClaude/memory/project_quality_policy.md)暂不修，代码顶部注明生产化做法）|

> SQLite 没有 `FOR UPDATE`，参考实现仅在 `db_driver == "postgres"` 时加行锁；SQLite 靠串行化写入避免竞态。

---

## 6. 登出与改密

### 6.1 登出 `POST /auth/logout`

- 请求体可选带 `refreshToken`；带了就把该条 `revoked_at = now`。
- **不带或 token 查无 → 仍返回 204**（幂等，不报错）。
- access token **不做服务端黑名单**：它本就 1 小时过期，登出后客户端丢弃即可。这意味着登出后、access token 自然过期前的窗口内，旧 access token 在技术上仍可验签——这是无状态 JWT 的固有取舍，1 小时 TTL 把窗口压到可接受。

### 6.2 改密 `POST /me/password`

```
1. 校验 currentPassword（bcrypt）→ 错 → 401
2. 写入新 password_hash
3. 吊销该 user 全部未撤销 refresh token
   （UPDATE refresh_tokens SET revoked_at=now
    WHERE user_id=? AND revoked_at IS NULL）
4. 提交
```

改密后所有旧设备的 refresh 链全部失效，下次刷新即被登出，必须用新密码重登。当前请求自己的 access token 不受影响（直到自然过期）。

---

## 7. 请求侧鉴权与前端协作

### 7.1 受保护端点

带 `Authorization: Bearer <accessToken>`。校验失败统一：

```json
401 { "errorCode": "UNAUTHORIZED", "message": "access_token_expired" | "invalid_token" }
```

匿名可访问的端点（广场、按码查胶囊、AI 创建辅助）即使带了过期 token 也不应报错——应忽略无效鉴权按匿名处理（这是 elysia / next-nuxt 早期都踩过的坑：公开端点对过期 token 抛 401 导致匿名浏览失败）。

### 7.2 前端自动刷新

```
请求 ──► 401 access_token_expired
            │
            ▼
   用 refreshToken 调 /auth/refresh
            │
     ┌──────┴──────┐
   成功            失败（整族作废 / 过期）
     │                │
  存新令牌对        清空登录态 → 跳登录
  重放原请求
```

参考前端的 `api/client.ts` 封装了这套自动刷新；要点是**单页内 refresh token 只轮换一次**——否则整页导航时上一页刚轮换、下一页用旧 token 再刷新会误触发重放检测、整族作废、误登出（next / nuxt 同源全栈修复过此问题）。

### 7.3 令牌存储策略（前端）

设计文档 §7.2 给出两档方案：

- **默认（更安全）**：access token 存内存，refresh token 存 `HttpOnly + Secure + SameSite=Lax` Cookie；用 Cookie 的实现必须额外处理 CSRF。
- **教学简化**：access token 存内存，refresh token + user 放 `localStorage`；必须在该实现 README 里写明 **XSS 风险**权衡。

两种都允许，但实现必须明示自己选了哪种及其代价。

---

## 8. 数据模型映射

鉴权只用到 `users` 和 `refresh_tokens` 两张表（schema 详见 [`docs/db-schema.md`](db-schema.md)）：

```
users
  id, email(唯一,小写), password_hash(bcrypt), nickname(唯一), avatar_id, ...

refresh_tokens
  id, user_id ──► users.id (ON DELETE CASCADE)
  token_hash (唯一, sha256)
  family_id        ← 轮转链标识，重放时按此整族撤销
  expires_at       ← 7 天
  revoked_at       ← NULL=有效；非空=已吊销
```

关键索引：`token_hash` 唯一索引（每次 refresh 按 hash 查行）、`family_id` 索引（整族撤销）、`user_id` 索引（改密整批撤销）、`expires_at` 索引（清理过期）。

---

## 9. 跨栈一致性核对清单

实现一套鉴权时，逐条对照（每条都有契约用例）：

- [ ] 注册/登录/refresh 返回完整 `AuthTokens`（含 `accessTokenExpiresIn` / `refreshTokenExpiresIn` / `user`）
- [ ] email 归一化小写；email 大小写不敏感唯一、nickname 大小写敏感唯一
- [ ] 注册冲突按 `field` 精确报 `email` / `nickname`
- [ ] 登录失败统一 `UNAUTHORIZED`，不泄露账号是否存在
- [ ] access token = JWT HS256，payload 含 `sub/nickname/avatarId/iat/exp`，1h
- [ ] refresh token 不透明、落库存 hash、7 天
- [ ] refresh 轮转：吊销旧、签发新、family 延续
- [ ] 重放已撤销 token → 整族作废 → 401
- [ ] logout 幂等（无 token 或查无也 204）
- [ ] 改密吊销该 user 全部 refresh token
- [ ] 受保护端点缺/坏 token → 401；公开端点忽略坏 token 按匿名处理
- [ ] 令牌存储策略在 README 写明取舍
