-- ============================================================
-- HelloTime Pro · Next.js 全栈 · PostgreSQL 初始化脚本
--
-- 与 spec/db/schema.sql 结构等价：
--   - UUID / TIMESTAMPTZ / VARCHAR(N) / CHAR(8) 用原生类型
--   - 所有 CHECK 约束齐全
--   - pgcrypto + pg_trgm 扩展，title / nickname 模糊搜索走 GIN
--
-- 应用层（services/*.ts）继续向时间列写 ISO 字符串、向 UUID 列
-- 写 randomUUID() 字符串，Postgres 会做 text → uuid / text → timestamptz
-- 隐式 cast，无需修改业务代码。
--
-- 注意：CREATE TABLE IF NOT EXISTS 在表已存在时**整段 no-op**，包括 CHECK
-- 约束。要让本迁移生效，请先 docker compose down -v 清掉旧库再 db:migrate。
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(254) NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    nickname        VARCHAR(20)  NOT NULL,
    avatar_id       VARCHAR(20)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT users_email_format_chk
        CHECK (email = lower(email) AND position('@' in email) > 1),
    CONSTRAINT users_nickname_length_chk
        CHECK (char_length(nickname) BETWEEN 2 AND 20)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk    ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_uk ON users (nickname);

-- 广场按创建者昵称模糊搜索（pg_trgm GIN）
CREATE INDEX IF NOT EXISTS users_nickname_trgm_ix
    ON users USING gin (lower(nickname) gin_trgm_ops);

-- ------------------------------------------------------------
-- capsules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capsules (
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

CREATE UNIQUE INDEX IF NOT EXISTS capsules_code_uk          ON capsules (code);
CREATE INDEX        IF NOT EXISTS capsules_plaza_hot_ix     ON capsules (in_plaza, favorite_count DESC, created_at DESC);
CREATE INDEX        IF NOT EXISTS capsules_plaza_new_ix     ON capsules (in_plaza, created_at DESC);
CREATE INDEX        IF NOT EXISTS capsules_plaza_open_at_ix ON capsules (in_plaza, open_at);
CREATE INDEX        IF NOT EXISTS capsules_owner_created_ix ON capsules (owner_id, created_at DESC);

-- 标题模糊搜索 GIN
CREATE INDEX IF NOT EXISTS capsules_title_trgm_ix
    ON capsules USING gin (lower(title) gin_trgm_ops);

-- ------------------------------------------------------------
-- favorites
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    user_id     UUID         NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
    capsule_id  UUID         NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, capsule_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_created_ix ON favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_capsule_ix      ON favorites (capsule_id);

-- ------------------------------------------------------------
-- refresh_tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   VARCHAR(100) NOT NULL,
    family_id    UUID         NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    revoked_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uk      ON refresh_tokens (token_hash);
CREATE INDEX        IF NOT EXISTS refresh_tokens_user_ix      ON refresh_tokens (user_id);
CREATE INDEX        IF NOT EXISTS refresh_tokens_family_ix    ON refresh_tokens (family_id);
CREATE INDEX        IF NOT EXISTS refresh_tokens_expires_ix   ON refresh_tokens (expires_at);
