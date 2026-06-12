import Vapor
import Foundation

/// 路由注册：presentation 层只做参数提取 + 调 service + 包 Envelope。
func registerRoutes(_ app: Application, _ c: AppComponents) {
    // ── 静态资源：头像 / 技术栈图标（相对仓库根的 spec/ 目录） ────────────
    app.get("static", "avatars", ":file") { req in
        try serveSpecFile(req, root: c.config.absRepoRoot, subdir: "spec/avatars")
    }
    app.get("static", "icons", ":file") { req in
        try serveSpecFile(req, root: c.config.absRepoRoot, subdir: "spec/icons")
    }

    // ── Health / Avatars ──────────────────────────────────────────────────
    app.get("api", "v1", "health") { _ in
        healthResponse(c)
    }

    app.get("api", "v1", "avatars") { _ in
        Envelope.ok(c.avatars.list())
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    app.post("api", "v1", "auth", "register") { req in
        Envelope.ok(try await c.authService.register(req.content.decode(RegisterRequest.self)),
                    status: .created)
    }
    app.post("api", "v1", "auth", "login") { req in
        Envelope.ok(try await c.authService.login(req.content.decode(LoginRequest.self)))
    }
    app.post("api", "v1", "auth", "refresh") { req in
        let body = try req.content.decode(RefreshRequest.self)
        return Envelope.ok(try await c.authService.refresh(body.refreshToken))
    }
    app.post("api", "v1", "auth", "logout") { req in
        let body = try? req.content.decode(LogoutRequest.self)
        try await c.authService.logout(body?.refreshToken)
        return Envelope.noContent()
    }

    // ── Me ────────────────────────────────────────────────────────────────
    app.get("api", "v1", "me") { req in
        let user = try await c.authContext.required(req)
        return Envelope.ok(c.userService.toJson(user))
    }
    app.patch("api", "v1", "me") { req in
        let user = try await c.authContext.required(req)
        let body = try req.content.decode(UpdateProfileRequest.self)
        return Envelope.ok(try await c.userService.updateProfile(user, body))
    }
    app.post("api", "v1", "me", "password") { req in
        let user = try await c.authContext.required(req)
        let body = try req.content.decode(ChangePasswordRequest.self)
        try await c.authService.changePassword(user, body)
        return Envelope.noContent()
    }
    app.get("api", "v1", "me", "capsules") { req in
        let user = try await c.authContext.required(req)
        return Envelope.ok(try await c.plazaService.myCapsules(
            user, page: try intParam(req, "page", 1), pageSize: try intParam(req, "pageSize", 20)
        ))
    }
    app.delete("api", "v1", "me", "capsules", ":id") { req in
        let user = try await c.authContext.required(req)
        try await c.capsuleService.deleteOwn(user, req.parameters.get("id") ?? "")
        return Envelope.noContent()
    }

    // ── Capsules ──────────────────────────────────────────────────────────
    app.post("api", "v1", "capsules") { req in
        let user = try await c.authContext.required(req)
        let body = try req.content.decode(CreateCapsuleRequest.self)
        return Envelope.ok(try await c.capsuleService.create(user, body), status: .created)
    }
    app.get("api", "v1", "capsules", ":code") { req in
        let viewer = try await c.authContext.optional(req)
        return Envelope.ok(try await c.capsuleService.getByCode(
            req.parameters.get("code") ?? "", viewerId: viewer?.id
        ))
    }

    // ── Plaza ─────────────────────────────────────────────────────────────
    app.get("api", "v1", "plaza", "capsules") { req in
        let viewer = try await c.authContext.optional(req)
        return Envelope.ok(try await c.plazaService.plazaList(
            sort: req.query[String.self, at: "sort"] ?? "new",
            filter: req.query[String.self, at: "filter"] ?? "all",
            q: req.query[String.self, at: "q"],
            page: try intParam(req, "page", 1),
            pageSize: try intParam(req, "pageSize", 20),
            viewerId: viewer?.id
        ))
    }
    app.get("api", "v1", "plaza", "capsules", ":id") { req in
        let viewer = try await c.authContext.optional(req)
        return Envelope.ok(try await c.capsuleService.getPlazaDetail(
            req.parameters.get("id") ?? "", viewerId: viewer?.id
        ))
    }

    // ── Favorites ─────────────────────────────────────────────────────────
    app.get("api", "v1", "me", "favorites") { req in
        let user = try await c.authContext.required(req)
        return Envelope.ok(try await c.plazaService.myFavorites(
            user, page: try intParam(req, "page", 1), pageSize: try intParam(req, "pageSize", 20)
        ))
    }
    app.post("api", "v1", "me", "favorites") { req in
        let user = try await c.authContext.required(req)
        let body = try req.content.decode(FavoriteRequest.self)
        return Envelope.ok(try await c.favoriteService.addFavorite(user, body.capsuleId))
    }
    app.delete("api", "v1", "me", "favorites", ":capsuleId") { req in
        let user = try await c.authContext.required(req)
        try await c.favoriteService.removeFavorite(user, req.parameters.get("capsuleId") ?? "")
        return Envelope.noContent()
    }

    // ── AI 建议 / 推荐 ────────────────────────────────────────────────────
    app.post("api", "v1", "capsule-suggestion") { req in
        let body = try req.content.decode(CapsuleSuggestionRequest.self)
        return Envelope.ok(try await c.suggestionService.suggest(body))
    }
    app.get("api", "v1", "capsule-recommendations") { req in
        let count: Int
        if let raw = req.query[String.self, at: "count"] {
            guard let parsed = Int(raw), (3...8).contains(parsed) else {
                throw ApiError.validation("count 必须是 [3, 8] 范围内的整数", "count")
            }
            count = parsed
        } else {
            count = 4
        }
        let locale = req.query[String.self, at: "locale"] ?? "zh-CN"
        return Envelope.ok(await c.recommendationService.getRecommendations(count: count, locale: locale))
    }
}

// ── 辅助 ───────────────────────────────────────────────────────────────────

/// 缺失才用默认值；存在但非整数 → 422（对齐 openapi 的 integer 约束）。
private func intParam(_ req: Request, _ name: String, _ fallback: Int) throws -> Int {
    guard let raw = req.query[String.self, at: name] else { return fallback }
    guard let value = Int(raw) else {
        throw ApiError.validation("\(name) 必须是整数", name)
    }
    return value
}

/// 提供 spec/ 下的静态 SVG（路径白名单 + 文件名防穿越）。
private func serveSpecFile(_ req: Request, root: String, subdir: String) throws -> Response {
    guard let file = req.parameters.get("file"),
          !file.contains(".."), !file.contains("/") else {
        throw ApiError.notFound("文件不存在")
    }
    let path = "\(root)/\(subdir)/\(file)"
    guard FileManager.default.fileExists(atPath: path) else {
        throw ApiError.notFound("文件不存在")
    }
    return req.fileio.streamFile(at: path)
}

private func healthResponse(_ c: AppComponents) -> Response {
    let isSqlite = c.db.isSqlite
    let summary = "基于 Swift + Vapor 的服务端实现。SwiftNIO 事件循环承载 HTTP，async/await 全链路异步，"
        + "SQLKit 手写参数化 SQL 同时驱动 PostgreSQL（连接池）与 SQLite（单连接 + FIFO 门闩串行化）。"
        + "跨库差异收敛在一个值编解码层：SQLite 存 32 位 hex UUID 与 ISO-8601 TEXT 时间戳，"
        + "Postgres 用原生 uuid/timestamptz。JWT（HS256）手写签发校验 + refresh token 轮转与家族吊销实现鉴权；"
        + "幂等 UPSERT + 原子自增维护收藏计数；响应统一手工构造 JSON 树，显式输出契约要求的 null 字段；"
        + "自定义中间件把业务异常统一转换为契约约定的错误响应外壳。"
    let items: [JSON] = [
        stackItem(role: "language", name: "Swift", version: "6.2", icon: "swift"),
        stackItem(role: "framework", name: "Vapor", version: "4", icon: "vapor"),
        stackItem(role: "runtime", name: "SwiftNIO", version: "2", icon: "swift"),
        stackItem(role: "database",
                  name: isSqlite ? "SQLite" : "PostgreSQL",
                  version: isSqlite ? "3" : "16",
                  icon: isSqlite ? "sqlite" : "postgresql"),
    ]
    let uptime = Int(Date().timeIntervalSince(c.startTime))
    return Envelope.ok(.object([
        "status": .string("ok"),
        "service": .string(c.config.serviceName),
        "version": .string(c.config.serviceVersion),
        "uptimeSeconds": .int(max(0, uptime)),
        "stack": .object([
            "kind": .string("backend"),
            "summary": .string(summary),
            "items": .array(items),
        ]),
    ]))
}

private func stackItem(role: String, name: String, version: String, icon: String) -> JSON {
    .object([
        "role": .string(role),
        "name": .string(name),
        "version": .string(version),
        "iconUrl": .string("/static/icons/\(icon).svg"),
    ])
}
