/**
 * 简易迁移：根据 DB_DRIVER 执行对应目录下的 SQL 文件（顺序：文件名升序）。
 * 不维护版本表 —— 教学项目，迁移文件用 IF NOT EXISTS 写法保证幂等。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(__dirname, "..");

  const driver = (process.env.DB_DRIVER ?? "postgres").toLowerCase();
  const migrationsDir = join(projectRoot, "drizzle", driver === "sqlite" ? "sqlite" : "pg");

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  console.log(`[migrate] driver=${driver} dir=${migrationsDir} files=${files.length}`);

  if (driver === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const url = process.env.DB_URL ?? "file:../../data/sqlite/hellotime.db";
    // 兼容 file:path / sqlite:///rel / sqlite:////abs（SQLAlchemy 风格）
    let path = url;
    if (path.startsWith("sqlite:///")) path = path.slice(10);
    else if (path.startsWith("file:")) path = path.slice(5);
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    for (const f of files) {
      const sql = readFileSync(join(migrationsDir, f), "utf8");
      db.exec(sql);
      console.log(`[migrate] applied ${f}`);
    }
    db.close();
  } else {
    const { Pool } = await import("pg");
    const url =
      process.env.DB_URL ?? "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro";
    const pool = new Pool({ connectionString: url });
    for (const f of files) {
      const sql = readFileSync(join(migrationsDir, f), "utf8");
      await pool.query(sql);
      console.log(`[migrate] applied ${f}`);
    }
    await pool.end();
  }
  console.log("[migrate] done");
}

main().catch((e) => {
  console.error("[migrate] failed:", e);
  process.exit(1);
});
