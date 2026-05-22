import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`PRAGMA foreign_keys = ON`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id             TEXT PRIMARY KEY CHECK (length(id) = 36),
        email          TEXT NOT NULL,
        password_hash  TEXT NOT NULL,
        nickname       TEXT NOT NULL,
        avatar_id      TEXT NOT NULL,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        CONSTRAINT users_email_format_chk CHECK (email = lower(email) AND instr(email, '@') > 1),
        CONSTRAINT users_nickname_length_chk CHECK (length(nickname) BETWEEN 2 AND 20)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk ON users (email)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_uk ON users (nickname)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS capsules (
        id              TEXT PRIMARY KEY CHECK (length(id) = 36),
        owner_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        code            TEXT NOT NULL CHECK (length(code) = 8),
        title           TEXT NOT NULL,
        content         TEXT NOT NULL,
        open_at         TEXT NOT NULL,
        in_plaza        INTEGER NOT NULL DEFAULT 1,
        favorite_count  INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        CONSTRAINT capsules_title_length_chk CHECK (length(title) BETWEEN 1 AND 60),
        CONSTRAINT capsules_content_length_chk CHECK (length(content) BETWEEN 1 AND 5000),
        CONSTRAINT capsules_favorite_count_nonneg_chk CHECK (favorite_count >= 0)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS capsules_code_uk ON capsules (code)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_plaza_hot_ix ON capsules (in_plaza, favorite_count DESC, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_plaza_new_ix ON capsules (in_plaza, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_plaza_open_at_ix ON capsules (in_plaza, open_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS capsules_owner_created_ix ON capsules (owner_id, created_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        capsule_id  TEXT NOT NULL REFERENCES capsules (id) ON DELETE CASCADE,
        created_at  TEXT NOT NULL,
        PRIMARY KEY (user_id, capsule_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS favorites_user_created_ix ON favorites (user_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS favorites_capsule_ix ON favorites (capsule_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id           TEXT PRIMARY KEY CHECK (length(id) = 36),
        user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash   TEXT NOT NULL,
        family_id    TEXT NOT NULL,
        expires_at   TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        revoked_at   TEXT
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
