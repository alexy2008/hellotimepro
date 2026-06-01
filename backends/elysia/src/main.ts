import { existsSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";
import { listAvatars } from "./avatars";
import { env } from "./config";
import { dbKind } from "./db";
import { ok, route, routeEmpty, errorResponse } from "./envelope";
import { ERR } from "./errors";
import { parse } from "./validation";
import {
  changePasswordSchema,
  createCapsuleSchema,
  favoriteSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  suggestionSchema,
  updateProfileSchema,
} from "./validation";
import { readClaims, requireClaims } from "./security";
import {
  addFavorite,
  changePassword,
  createCapsule,
  deleteOwnCapsule,
  getCapsuleByCode,
  getMe,
  getPlazaCapsuleById,
  login,
  logout,
  myCapsules,
  myFavorites,
  plazaList,
  refresh,
  register,
  removeFavorite,
  suggestCapsule,
  getCapsuleRecommendations,
  updateProfile,
} from "./services";

const startedAt = Date.now();

function pageParams(request: Request) {
  const s = new URL(request.url).searchParams;
  return {
    page: Number(s.get("page") ?? "1") || 1,
    pageSize: Number(s.get("pageSize") ?? "20") || 20,
  };
}

async function stackInfo() {
  const kind = await dbKind();
  const dbName = kind === "sqlite" ? "SQLite" : "PostgreSQL";
  const dbVersion = kind === "sqlite" ? "3" : "16";
  const dbIcon = kind === "sqlite" ? "sqlite" : "postgresql";
  return {
    kind: "backend",
    summary:
      "基于 Bun + Elysia + TypeScript 核心骨架，选用 Zod 作为数据校验工具，" +
      "jose 进行 JWT 处理，bcryptjs 处理密码哈希，同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。" +
      "依托 Bun 原生高性能运行时与内置 HTTP 服务器，提供卓越的 I/O 并发处理性能，" +
      "Elysia 框架极其轻量且专为 Bun 优化，提供流畅的链式路由注册与类型安全的数据响应。" +
      "通过 Zod Schema 进行请求体的强类型验证，在请求到达业务层前拦截不合法输入。" +
      "项目摒弃复杂的重量级 ORM，选用轻量级 SQL 原生连接，" +
      "自制了跨数据库占位符自动适配与连接池包装，" +
      "通过环境变量即可一键在 PostgreSQL 异步池与 Bun 内置的高速 SQLite 之间无缝切换。" +
      "项目严格按照呈现层、应用层、领域层与基础设施层进行四层架构划分，" +
      "业务代码与底层路由及数据库客户端互不耦合。",
    items: [
      {
        role: "language",
        name: "TypeScript",
        version: "5",
        iconUrl: "/static/icons/typescript.svg",
      },
      {
        role: "runtime",
        name: "Bun",
        version: "1",
        iconUrl: "/static/icons/bun.svg",
      },
      {
        role: "framework",
        name: "Elysia",
        version: "1",
        iconUrl: "/static/icons/elysia.svg",
      },
      {
        role: "database",
        name: dbName,
        version: dbVersion,
        iconUrl: `/static/icons/${dbIcon}.svg`,
      },
    ],
  };
}

function staticFile(kind: "avatars" | "icons", file: string) {
  if (!/^[a-z0-9_.-]+\.svg$/i.test(file)) return new Response("not found", { status: 404 });
  const path = join(process.cwd(), "..", "..", "spec", kind, file);
  if (!existsSync(path)) return new Response("not found", { status: 404 });
  return new Response(Bun.file(path), {
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
}

const app = new Elysia()
  .onError(({ error }) => errorResponse(error))
  .get("/static/avatars/:file", ({ params }) => staticFile("avatars", params.file))
  .get("/static/icons/:file", ({ params }) => staticFile("icons", params.file))
  .get("/api/v1/health", ({ set }) =>
    route(set, async () => ({
      status: "ok",
      service: env.serviceName,
      version: env.serviceVersion,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      stack: await stackInfo(),
    })),
  )
  .get("/api/v1/avatars", ({ set }) => route(set, () => listAvatars()))
  .post("/api/v1/capsule-suggestion", ({ set, body }) =>
    route(set, () => suggestCapsule(parse(suggestionSchema, body))),
  )
  .get("/api/v1/capsule-recommendations", ({ set, request }) =>
    route(set, () => {
      const raw = new URL(request.url).searchParams.get("count");
      let count = 4;
      if (raw !== null && raw !== "") {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 3 || n > 8) {
          throw ERR.validation("count 必须是 [3, 8] 范围内的整数", "count");
        }
        count = n;
      }
      return getCapsuleRecommendations(count);
    }),
  )
  .post("/api/v1/auth/register", ({ set, body }) =>
    route(set, () => register(parse(registerSchema, body)), 201),
  )
  .post("/api/v1/auth/login", ({ set, body }) =>
    route(set, () => login(parse(loginSchema, body))),
  )
  .post("/api/v1/auth/refresh", ({ set, body }) =>
    route(set, () => refresh(parse(refreshSchema, body).refreshToken)),
  )
  .post("/api/v1/auth/logout", ({ body }) =>
    routeEmpty(async () => {
      let refreshToken: string | undefined;
      try {
        refreshToken = parse(logoutSchema, body).refreshToken;
      } catch {
        refreshToken = undefined;
      }
      await logout(refreshToken);
    }),
  )
  .get("/api/v1/me", ({ set, request }) =>
    route(set, async () => {
      const claims = await requireClaims(request.headers);
      return getMe(claims.id);
    }),
  )
  .patch("/api/v1/me", ({ set, body, request }) =>
    route(set, async () => {
      const claims = await requireClaims(request.headers);
      return updateProfile(claims.id, parse(updateProfileSchema, body));
    }),
  )
  .post("/api/v1/me/password", ({ body, request }) =>
    routeEmpty(async () => {
      const claims = await requireClaims(request.headers);
      const input = parse(changePasswordSchema, body);
      await changePassword(claims.id, input.currentPassword, input.newPassword);
    }),
  )
  .post("/api/v1/capsules", ({ set, body, request }) =>
    route(set, async () => {
      const claims = await requireClaims(request.headers);
      return createCapsule(claims.id, parse(createCapsuleSchema, body));
    }, 201),
  )
  .get("/api/v1/capsules/:code", ({ set, params, request }) =>
    route(set, async () => {
      const claims = await readClaims(request.headers);
      return getCapsuleByCode(params.code, claims?.id ?? null);
    }),
  )
  .get("/api/v1/plaza/capsules", ({ set, request }) =>
    route(set, async () => {
      const claims = await readClaims(request.headers);
      const s = new URL(request.url).searchParams;
      const { page, pageSize } = pageParams(request);
      return plazaList({
        sort: s.get("sort") ?? "new",
        filter: s.get("filter") ?? "all",
        q: s.get("q"),
        page,
        pageSize,
        viewerId: claims?.id ?? null,
      });
    }),
  )
  .get("/api/v1/plaza/capsules/:id", ({ set, params, request }) =>
    route(set, async () => {
      const claims = await readClaims(request.headers);
      return getPlazaCapsuleById(params.id, claims?.id ?? null);
    }),
  )
  .get("/api/v1/me/capsules", ({ set, request }) =>
    route(set, async () => {
      const claims = await requireClaims(request.headers);
      const { page, pageSize } = pageParams(request);
      return myCapsules(claims.id, page, pageSize);
    }),
  )
  .delete("/api/v1/me/capsules/:id", ({ params, request }) =>
    routeEmpty(async () => {
      const claims = await requireClaims(request.headers);
      await deleteOwnCapsule(claims.id, params.id);
    }),
  )
  .get("/api/v1/me/favorites", ({ set, request }) =>
    route(set, async () => {
      const claims = await requireClaims(request.headers);
      const { page, pageSize } = pageParams(request);
      return myFavorites(claims.id, page, pageSize);
    }),
  )
  .post("/api/v1/me/favorites", ({ set, body, request }) =>
    route(set, async () => {
      const claims = await requireClaims(request.headers);
      const input = parse(favoriteSchema, body);
      return addFavorite(claims.id, input.capsuleId);
    }),
  )
  .delete("/api/v1/me/favorites/:capsuleId", ({ params, request }) =>
    routeEmpty(async () => {
      const claims = await requireClaims(request.headers);
      await removeFavorite(claims.id, params.capsuleId);
    }),
  )
  .listen({ port: env.port, hostname: "0.0.0.0" });

console.log(`hellotime-pro elysia listening on http://127.0.0.1:${app.server?.port ?? env.port}`);
