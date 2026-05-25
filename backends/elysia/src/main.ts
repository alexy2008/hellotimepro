import { existsSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";
import { listAvatars } from "./avatars";
import { env } from "./config";
import { dbKind, migrate } from "./db";
import { ok, route, routeEmpty, errorResponse } from "./envelope";
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
      "基于 Bun + Elysia + TypeScript 的后端实现，使用轻量路由层、Zod 请求校验、jose JWT 双令牌鉴权，并通过同一套 SQL 适配 PostgreSQL 与 SQLite。",
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

await migrate();

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
