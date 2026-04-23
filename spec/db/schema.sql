-- ============================================================
-- HelloTime Pro · 数据库 Schema（规范事实源）
-- 版本：0.1 · 2026-04-20
--
-- 本文件使用 PostgreSQL 16 方言。所有后端 / 全栈的迁移工具
-- 必须以此为"事实基准"，实际运行时的 DDL 由各栈的迁移框架
-- （Alembic / Flyway / golang-migrate / Drizzle / ...）生成，
-- 但产出的 schema 必须与本文件结构等价。
--
-- SQLite 方言差异：
--   - UUID 用 TEXT CHECK length=36 替代
--   - TIMESTAMPTZ 用 TEXT（ISO 8601）替代
--   - gen_random_uuid() 由应用层生成 UUID 传入
--   - 所有 DEFAULT now() 由应用层在写入时填
-- ============================================================

-- pgcrypto 提供 gen_random_uuid()；Postgres 13+ 内置 pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pg_trgm 提供 GIN 索引，加速广场模糊搜索（title / nickname）
-- SQLite 无等价扩展，模糊搜索走全表 LIKE 扫描（教学项目可接受）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE users (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    nickname       VARCHAR(20)  NOT NULL,
    avatar_id      VARCHAR(20)  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT users_email_format_chk
        CHECK (email = lower(email) AND position('@' in email) > 1),
    CONSTRAINT users_nickname_length_chk
        CHECK (char_length(nickname) BETWEEN 2 AND 20)
);

-- 邮箱大小写不敏感唯一（存储已统一小写，普通 UNIQUE 即可）
CREATE UNIQUE INDEX users_email_uk   ON users (email);
-- 昵称大小写敏感唯一
CREATE UNIQUE INDEX users_nickname_uk ON users (nickname);

-- 广场按创建者昵称模糊搜索（pg_trgm GIN；SQLite 跳过）
CREATE INDEX users_nickname_trgm_ix
    ON users USING gin (lower(nickname) gin_trgm_ops);

-- ------------------------------------------------------------
-- capsules
-- ------------------------------------------------------------
CREATE TABLE capsules (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code            CHAR(8)      NOT NULL,
    title           VARCHAR(60)  NOT NULL,
    content         TEXT         NOT NULL,
    open_at         TIMESTAMPTZ  NOT NULL,
    in_plaza        BOOLEAN      NOT NULL DEFAULT TRUE,
    favorite_count  INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT capsules_code_format_chk
        CHECK (code ~ '^[A-Z0-9]{8}$'),
    CONSTRAINT capsules_title_length_chk
        CHECK (char_length(title) BETWEEN 1 AND 60),
    CONSTRAINT capsules_content_length_chk
        CHECK (char_length(content) BETWEEN 1 AND 5000),
    CONSTRAINT capsules_open_after_create_chk
        CHECK (open_at > created_at + INTERVAL '60 seconds'),
    CONSTRAINT capsules_favorite_count_nonneg_chk
        CHECK (favorite_count >= 0)
);

CREATE UNIQUE INDEX capsules_code_uk ON capsules (code);

-- 广场最热：in_plaza 过滤 + 热度降序 + 创建时间 tie-breaker
CREATE INDEX capsules_plaza_hot_ix
    ON capsules (in_plaza, favorite_count DESC, created_at DESC);

-- 广场最新：in_plaza 过滤 + 创建时间降序
CREATE INDEX capsules_plaza_new_ix
    ON capsules (in_plaza, created_at DESC);

-- 广场 filter=opened/unopened：open_at 过滤支撑
CREATE INDEX capsules_plaza_open_at_ix
    ON capsules (in_plaza, open_at);

-- "我创建的"列表支撑
CREATE INDEX capsules_owner_created_ix
    ON capsules (owner_id, created_at DESC);

-- 广场按标题模糊搜索（pg_trgm GIN；SQLite 跳过）
CREATE INDEX capsules_title_trgm_ix
    ON capsules USING gin (lower(title) gin_trgm_ops);

-- ------------------------------------------------------------
-- favorites
-- ------------------------------------------------------------
-- 复合主键 (user_id, capsule_id) 天然去重
-- 不变式 I1（不能收藏自己）用业务层校验，SQLite 不支持 subquery CHECK
CREATE TABLE favorites (
    user_id     UUID         NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
    capsule_id  UUID         NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, capsule_id)
);

-- "我收藏的"列表：按收藏时间降序
CREATE INDEX favorites_user_created_ix
    ON favorites (user_id, created_at DESC);

-- 反查"哪些人收藏了这个胶囊"（未来可能用于聚合）
CREATE INDEX favorites_capsule_ix
    ON favorites (capsule_id);

-- ------------------------------------------------------------
-- refresh_tokens
-- ------------------------------------------------------------
-- 每次 refresh 生成新行 + 旧行 revoked_at = now()，family_id 延续
-- 若遇到已 revoked 的 token，整个 family 作废
CREATE TABLE refresh_tokens (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   VARCHAR(100) NOT NULL,
    family_id    UUID         NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    revoked_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX refresh_tokens_hash_uk   ON refresh_tokens (token_hash);
CREATE INDEX        refresh_tokens_user_ix   ON refresh_tokens (user_id);
CREATE INDEX        refresh_tokens_family_ix ON refresh_tokens (family_id);
-- 清理过期 token 用
CREATE INDEX        refresh_tokens_expires_ix ON refresh_tokens (expires_at);
