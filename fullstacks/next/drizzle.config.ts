import type { Config } from "drizzle-kit";

const driver = process.env.DB_DRIVER ?? "postgres";

export default (driver === "sqlite"
  ? {
      schema: "./src/db/schema-sqlite.ts",
      out: "./drizzle/sqlite",
      dialect: "sqlite",
      dbCredentials: {
        url:
          process.env.DB_URL ??
          "file:" + new URL("../../data/sqlite/hellotime.db", import.meta.url).pathname,
      },
    }
  : {
      schema: "./src/db/schema-pg.ts",
      out: "./drizzle/pg",
      dialect: "postgresql",
      dbCredentials: {
        url:
          process.env.DB_URL ??
          "postgresql://hellotime:hellotime@127.0.0.1:55432/hellotime_pro",
      },
    }) satisfies Config;
