import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id             VARCHAR(36)  PRIMARY KEY,
        email          VARCHAR(254) NOT NULL,
        password_hash  VARCHAR(100) NOT NULL,
        nickname       VARCHAR(20)  NOT NULL,
        avatar_id      VARCHAR(20)  NOT NULL,
        created_at     TIMESTAMPTZ  NOT NULL,
        updated_at     TIMESTAMPTZ  NOT NULL,
        CONSTRAINT users_email_format_chk CHECK (email = lower(email) AND position('@' in email) > 1),
        CONSTRAINT users_nickname_length_chk CHECK (char_length(nickname) BETWEEN 2 AND 20)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk ON users (email)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_uk ON users (nickname)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS users_nickname_trgm_ix ON users USING gin (lower(nickname) gin_trgm_ops)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS capsules (
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
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS capsules_code_uk ON capsules (code)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_plaza_hot_ix ON capsules (in_plaza, favorite_count DESC, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_plaza_new_ix ON capsules (in_plaza, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_plaza_open_at_ix ON capsules (in_plaza, open_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_owner_created_ix ON capsules (owner_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_title_trgm_ix ON capsules USING gin (lower(title) gin_trgm_ops)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id     VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        capsule_id  VARCHAR(36)  NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ  NOT NULL,
        PRIMARY KEY (user_id, capsule_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS favorites_user_created_ix ON favorites (user_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS favorites_capsule_ix ON favorites (capsule_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id           VARCHAR(36)  PRIMARY KEY,
        user_id      VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash   VARCHAR(100) NOT NULL,
        family_id    VARCHAR(36)  NOT NULL,
        expires_at   TIMESTAMPTZ  NOT NULL,
        created_at   TIMESTAMPTZ  NOT NULL,
        revoked_at   TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uk ON refresh_tokens (token_hash)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS refresh_tokens_user_ix ON refresh_tokens (user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS refresh_tokens_family_ix ON refresh_tokens (family_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS refresh_tokens_expires_ix ON refresh_tokens (expires_at)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS favorites`);
    await queryRunner.query(`DROP TABLE IF EXISTS capsules`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
