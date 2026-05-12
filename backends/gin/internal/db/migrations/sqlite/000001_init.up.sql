-- HelloTime Pro · SQLite 初始 schema
-- 版本：000001
--
-- 与 spec/db/schema.sql 同构（方言降级）：
--   - UUID 用 TEXT（应用层生成 36 字符 UUID 字符串）
--   - BOOLEAN 用 INTEGER（0/1）
--   - **TIMESTAMPTZ 用 DATETIME**（关键！）
--
-- 时间列类型必须声明为 DATETIME / TIMESTAMP（而非裸 TEXT）。
-- 因为 mattn/go-sqlite3 驱动只有看到列的 declared type 是这几个时间关键字才会
-- 把存储的字符串自动解析回 time.Time。声明为 TEXT 会让 GORM scan 报：
--   sql: Scan error ... storing driver.Value type string into type *time.Time
-- 表现为：register 成功（INSERT 走的是 string，没问题），但任何 SELECT 进
-- model.User 都失败，所有 RequireAuth 的端点返回 401 "用户不存在"。
-- SQLite 本身是动态类型，DATETIME / TEXT 在存储层等价；这只是个声明。

CREATE TABLE IF NOT EXISTS users (
    id             TEXT     PRIMARY KEY,
    email          TEXT     NOT NULL,
    password_hash  TEXT     NOT NULL,
    nickname       TEXT     NOT NULL,
    avatar_id      TEXT     NOT NULL,
    created_at     DATETIME NOT NULL,
    updated_at     DATETIME NOT NULL,

    CONSTRAINT users_email_format_chk
        CHECK (email = lower(email) AND instr(email, '@') > 1),
    CONSTRAINT users_nickname_length_chk
        CHECK (length(nickname) BETWEEN 2 AND 20)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk    ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_uk ON users (nickname);

CREATE TABLE IF NOT EXISTS capsules (
    id              TEXT     PRIMARY KEY,
    owner_id        TEXT     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code            TEXT     NOT NULL,
    title           TEXT     NOT NULL,
    content         TEXT     NOT NULL,
    open_at         DATETIME NOT NULL,
    in_plaza        INTEGER  NOT NULL DEFAULT 1,
    favorite_count  INTEGER  NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,

    CONSTRAINT capsules_code_format_chk
        CHECK (length(code) = 8 AND code GLOB '[A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9][A-Z0-9]'),
    CONSTRAINT capsules_title_length_chk
        CHECK (length(title) BETWEEN 1 AND 60),
    CONSTRAINT capsules_content_length_chk
        CHECK (length(content) BETWEEN 1 AND 5000),
    CONSTRAINT capsules_open_after_create_chk
        CHECK (open_at > datetime(created_at, '+60 seconds')),
    CONSTRAINT capsules_favorite_count_nonneg_chk
        CHECK (favorite_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS capsules_code_uk          ON capsules (code);
CREATE        INDEX IF NOT EXISTS capsules_owner_created_ix ON capsules (owner_id, created_at DESC);
CREATE        INDEX IF NOT EXISTS capsules_plaza_hot_ix     ON capsules (in_plaza, favorite_count DESC, created_at DESC);
CREATE        INDEX IF NOT EXISTS capsules_plaza_new_ix     ON capsules (in_plaza, created_at DESC);
CREATE        INDEX IF NOT EXISTS capsules_plaza_open_at_ix ON capsules (in_plaza, open_at);

CREATE TABLE IF NOT EXISTS favorites (
    user_id     TEXT     NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
    capsule_id  TEXT     NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
    created_at  DATETIME NOT NULL,
    PRIMARY KEY (user_id, capsule_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_created_ix ON favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_capsule_ix      ON favorites (capsule_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          TEXT     PRIMARY KEY,
    user_id     TEXT     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  TEXT     NOT NULL,
    family_id   TEXT     NOT NULL,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME NOT NULL,
    revoked_at  DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uk    ON refresh_tokens (token_hash);
CREATE        INDEX IF NOT EXISTS refresh_tokens_user_ix    ON refresh_tokens (user_id);
CREATE        INDEX IF NOT EXISTS refresh_tokens_family_ix  ON refresh_tokens (family_id);
CREATE        INDEX IF NOT EXISTS refresh_tokens_expires_ix ON refresh_tokens (expires_at);
