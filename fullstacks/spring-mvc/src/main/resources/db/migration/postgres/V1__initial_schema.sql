CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
    id             VARCHAR(36)  PRIMARY KEY,
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    nickname       VARCHAR(20)  NOT NULL,
    avatar_id      VARCHAR(20)  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL,
    updated_at     TIMESTAMPTZ  NOT NULL,
    CONSTRAINT users_email_format_chk CHECK (email = lower(email) AND position('@' in email) > 1),
    CONSTRAINT users_nickname_length_chk CHECK (char_length(nickname) BETWEEN 2 AND 20)
);

CREATE UNIQUE INDEX users_email_uk ON users (email);
CREATE UNIQUE INDEX users_nickname_uk ON users (nickname);
CREATE INDEX users_nickname_trgm_ix ON users USING gin (lower(nickname) gin_trgm_ops);

CREATE TABLE capsules (
    id              VARCHAR(36)  PRIMARY KEY,
    owner_id        VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code            CHAR(8)      NOT NULL,
    title           VARCHAR(60)  NOT NULL,
    content         TEXT         NOT NULL,
    open_at         TIMESTAMPTZ  NOT NULL,
    in_plaza        BOOLEAN      NOT NULL DEFAULT TRUE,
    favorite_count  INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL,
    CONSTRAINT capsules_code_format_chk CHECK (code ~ '^[A-Z0-9]{8}$'),
    CONSTRAINT capsules_title_length_chk CHECK (char_length(title) BETWEEN 1 AND 60),
    CONSTRAINT capsules_content_length_chk CHECK (char_length(content) BETWEEN 1 AND 5000),
    CONSTRAINT capsules_open_after_create_chk CHECK (open_at > created_at + INTERVAL '60 seconds'),
    CONSTRAINT capsules_favorite_count_nonneg_chk CHECK (favorite_count >= 0)
);

CREATE UNIQUE INDEX capsules_code_uk ON capsules (code);
CREATE INDEX capsules_plaza_hot_ix ON capsules (in_plaza, favorite_count DESC, created_at DESC);
CREATE INDEX capsules_plaza_new_ix ON capsules (in_plaza, created_at DESC);
CREATE INDEX capsules_plaza_open_at_ix ON capsules (in_plaza, open_at);
CREATE INDEX capsules_owner_created_ix ON capsules (owner_id, created_at DESC);
CREATE INDEX capsules_title_trgm_ix ON capsules USING gin (lower(title) gin_trgm_ops);

CREATE TABLE favorites (
    user_id     VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    capsule_id  VARCHAR(36)  NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (user_id, capsule_id)
);

CREATE INDEX favorites_user_created_ix ON favorites (user_id, created_at DESC);
CREATE INDEX favorites_capsule_ix ON favorites (capsule_id);

CREATE TABLE refresh_tokens (
    id           VARCHAR(36)  PRIMARY KEY,
    user_id      VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   VARCHAR(100) NOT NULL,
    family_id    VARCHAR(36)  NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL,
    revoked_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX refresh_tokens_hash_uk ON refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_user_ix ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_ix ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_expires_ix ON refresh_tokens (expires_at);
