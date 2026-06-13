# HelloTime Pro · 数据库 Schema

> 规范事实源是 [`spec/db/schema.sql`](../spec/db/schema.sql)（PostgreSQL 16 方言，140 行）。20 个实现各用自己的迁移工具（Alembic / Flyway / golang-migrate / Drizzle / EF Core / …）产出 DDL，但结构必须与该文件**等价**。本文是它的可视化与字段级注解。
>
> 运行期 schema 由仓库级脚本统一创建：`./scripts/db init`（建表）、`./scripts/db reset --seed`（重建并导入演示数据）。后端 `run` 脚本不建表、不迁移。

---

## 1. 实体关系总览

```
┌─────────────────┐
│      users      │
│─────────────────│
│ id (PK)         │◄──────────────┐◄───────────────┐
│ email (UQ)      │               │                │
│ password_hash   │               │ owner_id       │ user_id
│ nickname (UQ)   │               │ (CASCADE)      │ (CASCADE)
│ avatar_id       │               │                │
│ created_at      │       ┌───────┴────────┐  ┌────┴───────────┐
│ updated_at      │       │   capsules     │  │ refresh_tokens │
└─────────────────┘       │────────────────│  │────────────────│
        ▲                 │ id (PK)        │◄┐│ id (PK)        │
        │ capsule_id      │ owner_id (FK)  │ ││ user_id (FK)   │
        │ (CASCADE)       │ code (UQ)      │ ││ token_hash(UQ) │
        │                 │ title          │ ││ family_id      │
┌───────┴────────┐        │ content        │ ││ expires_at     │
│   favorites    │        │ open_at        │ ││ revoked_at     │
│────────────────│        │ in_plaza       │ ││ created_at     │
│ user_id (PK,FK)│        │ favorite_count │ │└────────────────┘
│ capsule_id     │────────│ created_at     │ │
│   (PK,FK)      │        │ updated_at     │ │
│ created_at     │        └────────────────┘ │
└────────────────┘                 │         │
                                   └─────────┘
                          favorites.capsule_id → capsules.id
```

关系（全部 `ON DELETE CASCADE`）：

| 关系 | 基数 | 删除行为 |
|---|---|---|
| users → capsules | 1 : N | 删用户 → 其胶囊全删 |
| users → refresh_tokens | 1 : N | 删用户 → 其令牌全删 |
| users → favorites | 1 : N | 删用户 → 其收藏全删 |
| capsules → favorites | 1 : N | 删胶囊 → 相关收藏全删 |

`favorites` 是 users 与 capsules 的多对多连接表，复合主键 `(user_id, capsule_id)` 天然去重。

---

## 2. 表定义

### 2.1 `users`

| 字段 | 类型 (PG) | 约束 |
|---|---|---|
| `id` | `UUID` | PK，默认 `gen_random_uuid()` |
| `email` | `VARCHAR(254)` | NOT NULL，唯一（小写存储） |
| `password_hash` | `VARCHAR(100)` | NOT NULL，bcrypt |
| `nickname` | `VARCHAR(20)` | NOT NULL，唯一（大小写敏感） |
| `avatar_id` | `VARCHAR(20)` | NOT NULL，对应 `spec/avatars/catalog.json` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` |

CHECK 约束：
- `users_email_format_chk`：`email = lower(email)` 且含 `@`（强制小写、基本格式）
- `users_nickname_length_chk`：昵称长度 2–20

索引：
- `users_email_uk`（唯一）— 登录按 email 查；因存储已小写，普通 UNIQUE 即大小写不敏感
- `users_nickname_uk`（唯一）— 昵称唯一性
- `users_nickname_trgm_ix`（GIN / pg_trgm）— 广场按创建者昵称模糊搜索；**SQLite 无此扩展，跳过**

### 2.2 `capsules`

| 字段 | 类型 (PG) | 约束 |
|---|---|---|
| `id` | `UUID` | PK，默认 `gen_random_uuid()` |
| `owner_id` | `UUID` | NOT NULL，FK → `users.id` CASCADE |
| `code` | `CHAR(8)` | NOT NULL，唯一，`[A-Z0-9]{8}` |
| `title` | `VARCHAR(60)` | NOT NULL，长度 1–60 |
| `content` | `TEXT` | NOT NULL，长度 1–5000 |
| `open_at` | `TIMESTAMPTZ` | NOT NULL，解锁时间 |
| `in_plaza` | `BOOLEAN` | NOT NULL，默认 `TRUE` |
| `favorite_count` | `INTEGER` | NOT NULL，默认 0，**冗余计数** |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` |

CHECK 约束：
- `capsules_code_format_chk`：`code ~ '^[A-Z0-9]{8}$'`
- `capsules_title_length_chk`：标题 1–60
- `capsules_content_length_chk`：正文 1–5000
- `capsules_open_after_create_chk`：`open_at > created_at + 60 秒`（不变式 I4）
- `capsules_favorite_count_nonneg_chk`：`favorite_count >= 0`

索引（5 个，全部服务于广场与列表查询）：

| 索引 | 列 | 支撑的查询 |
|---|---|---|
| `capsules_code_uk` | `code` 唯一 | 按 8 位码取胶囊 |
| `capsules_plaza_hot_ix` | `(in_plaza, favorite_count DESC, created_at DESC)` | 广场「最热」 |
| `capsules_plaza_new_ix` | `(in_plaza, created_at DESC)` | 广场「最新」 |
| `capsules_plaza_open_at_ix` | `(in_plaza, open_at)` | 广场 `filter=opened/unopened` |
| `capsules_owner_created_ix` | `(owner_id, created_at DESC)` | 「我创建的」列表 |
| `capsules_title_trgm_ix` | GIN `lower(title)` | 标题模糊搜索；**SQLite 跳过** |

> **不可变性**：胶囊的 `content` 与 `open_at` 创建后不可改（设计决策）。用户可随时删除自己的胶囊，但不能编辑内容或解锁时间。

### 2.3 `favorites`

| 字段 | 类型 (PG) | 约束 |
|---|---|---|
| `user_id` | `UUID` | NOT NULL，FK → `users.id` CASCADE |
| `capsule_id` | `UUID` | NOT NULL，FK → `capsules.id` CASCADE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` |
| PK | `(user_id, capsule_id)` | 复合主键，天然去重 |

索引：
- `favorites_user_created_ix`：`(user_id, created_at DESC)` —「我收藏的」列表
- `favorites_capsule_ix`：`(capsule_id)` — 反查谁收藏了某胶囊

> **不变式 I1（不能收藏自己的胶囊）**走业务层校验，不用 DB CHECK——因为需要 subquery，而 SQLite 不支持 subquery CHECK，统一在 service 层判。

### 2.4 `refresh_tokens`

| 字段 | 类型 (PG) | 约束 |
|---|---|---|
| `id` | `UUID` | PK，默认 `gen_random_uuid()` |
| `user_id` | `UUID` | NOT NULL，FK → `users.id` CASCADE |
| `token_hash` | `VARCHAR(100)` | NOT NULL，唯一，sha256（明文不入库） |
| `family_id` | `UUID` | NOT NULL，轮转链标识 |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL，7 天 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` |
| `revoked_at` | `TIMESTAMPTZ` | NULL=有效；非空=已吊销 |

索引：
- `refresh_tokens_hash_uk`（唯一）— 每次 refresh 按 hash 查行
- `refresh_tokens_user_ix` — 改密时按 user 整批撤销
- `refresh_tokens_family_ix` — 重放检测时整族撤销
- `refresh_tokens_expires_ix` — 清理过期令牌

> 轮转 / 家族 / 重放语义详见 [`docs/auth.md`](auth.md) §5。

---

## 3. 两条关键不变式

### I2 · `favorite_count` 冗余计数

```
capsules.favorite_count  ==  COUNT(favorites WHERE capsule_id = capsules.id)
```

`favorite_count` 是**反规范化**字段，存在的唯一理由是让广场「最热」排序不必每次 `JOIN + COUNT` 收藏表（广场是最高频读路径）。代价是每次收藏 / 取消收藏都必须在**同一事务**里同步更新计数：

```sql
-- 收藏（伪代码）
BEGIN;
  INSERT INTO favorites (user_id, capsule_id) VALUES (?, ?);
  UPDATE capsules SET favorite_count = favorite_count + 1 WHERE id = ?;
COMMIT;
```

各栈按自己的事务习惯实现（`@Transactional` / 显式事务 / 触发器）。这是 `verify-contract` 并发收藏用例重点覆盖的不变式。

### I3 · `code` 8 位唯一

胶囊 `code` 是 `[A-Z0-9]{8}` 的随机串，由应用层生成、唯一索引保证不撞。生成时若撞唯一约束，重试最多 5 次（捕获 `capsules_code_uk` 冲突再重试，其它异常立即抛出——elysia 早期把所有异常都当成撞码重试，掩盖了真实 DB 错误）。

---

## 4. PostgreSQL ↔ SQLite 方言映射

每个实现必须同时支持两库（`DB_DRIVER=postgres|sqlite`）。schema 的方言差异是跨栈最集中的坑（参见 [`docs/dev-notes.md`](dev-notes.md) 与各栈 TECHNICAL_GUIDE）：

| 概念 | PostgreSQL | SQLite |
|---|---|---|
| UUID | 原生 `UUID` 类型 | `TEXT`，存 32 位无横线 hex 或 36 位带横线（实现需一致） |
| 时间戳 | `TIMESTAMPTZ` | `TEXT`（ISO-8601 字符串） |
| UUID 生成 | `gen_random_uuid()`（pgcrypto） | 应用层生成传入 |
| `DEFAULT now()` | DB 默认值 | 应用层写入时填 |
| 模糊搜索 | `pg_trgm` GIN 索引 | 无扩展，全表 `LIKE` 扫描（教学可接受） |
| 行锁 | `SELECT ... FOR UPDATE` | 无，靠串行化写入 / 连接池=1 / actor |

**字符串比较的隐患**：SQLite 把时间戳存成 ISO TEXT，意味着 `open_at <= now` 与 `ORDER BY created_at` 实际是**字符串比较**——只有当所有写入方都用**同一种 ISO 格式**（带 `T`、统一时区偏移）时才正确。这正是 Spring Boot 双驱动回归（2026-06-02）的根因：seed 写 `2026-04-14T16:00:00+00:00`，而 sqlite-jdbc 期望 `yyyy-MM-dd HH:mm:ss.SSS`，解析失败。各栈普遍用「跨库 JdbcType / ValueConverter / 值编解码层」按方言分流读写格式，详见 [`docs/backend-comparison.md`](backend-comparison.md) §6–§7。

---

## 5. 复现与查看

```bash
# 查看规范 schema
cat spec/db/schema.sql

# 建表（按当前 DB_DRIVER）
./scripts/db init

# 重建并导入演示数据
./scripts/db reset --seed

# 查看状态
./scripts/db status
```

> 参考：鉴权数据流见 [`docs/auth.md`](auth.md)；跨库适配的各栈写法见 [`docs/backend-comparison.md`](backend-comparison.md)、[`docs/fullstack-comparison.md`](fullstack-comparison.md)。
