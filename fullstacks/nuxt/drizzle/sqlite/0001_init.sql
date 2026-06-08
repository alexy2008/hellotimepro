-- HelloTime Pro · Nuxt 3 全栈 · SQLite 初始化脚本

CREATE TABLE IF NOT EXISTS users (
    id              TEXT     PRIMARY KEY,
    email           TEXT     NOT NULL,
    password_hash   TEXT     NOT NULL,
    nickname        TEXT     NOT NULL,
    avatar_id       TEXT     NOT NULL,
    created_at      TEXT     NOT NULL,
    updated_at      TEXT     NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk    ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_uk ON users (nickname);

CREATE TABLE IF NOT EXISTS capsules (
    id              TEXT     PRIMARY KEY,
    owner_id        TEXT     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code            TEXT     NOT NULL,
    title           TEXT     NOT NULL,
    content         TEXT     NOT NULL,
    open_at         TEXT     NOT NULL,
    in_plaza        INTEGER  NOT NULL DEFAULT 1,
    favorite_count  INTEGER  NOT NULL DEFAULT 0,
    created_at      TEXT     NOT NULL,
    updated_at      TEXT     NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS capsules_code_uk          ON capsules (code);
CREATE INDEX        IF NOT EXISTS capsules_plaza_hot_ix     ON capsules (in_plaza, favorite_count DESC, created_at DESC);
CREATE INDEX        IF NOT EXISTS capsules_plaza_new_ix     ON capsules (in_plaza, created_at DESC);
CREATE INDEX        IF NOT EXISTS capsules_plaza_open_at_ix ON capsules (in_plaza, open_at);
CREATE INDEX        IF NOT EXISTS capsules_owner_created_ix ON capsules (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS favorites (
    user_id     TEXT  NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
    capsule_id  TEXT  NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
    created_at  TEXT  NOT NULL,
    PRIMARY KEY (user_id, capsule_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_created_ix ON favorites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           TEXT  PRIMARY KEY,
    user_id      TEXT  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   TEXT  NOT NULL,
    family_id    TEXT  NOT NULL,
    expires_at   TEXT  NOT NULL,
    created_at   TEXT  NOT NULL,
    revoked_at   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uk    ON refresh_tokens (token_hash);
CREATE INDEX        IF NOT EXISTS refresh_tokens_user_ix    ON refresh_tokens (user_id);
CREATE INDEX        IF NOT EXISTS refresh_tokens_family_ix  ON refresh_tokens (family_id);
