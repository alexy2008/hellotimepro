package com.hellotimepro.ktor

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.db.Db
import com.hellotimepro.ktor.dto.ChangePasswordRequest
import com.hellotimepro.ktor.dto.CreateCapsuleRequest
import com.hellotimepro.ktor.dto.Envelope
import com.hellotimepro.ktor.dto.ErrorDetail
import com.hellotimepro.ktor.dto.ErrorEnvelope
import com.hellotimepro.ktor.dto.FavoriteRequest
import com.hellotimepro.ktor.dto.HealthData
import com.hellotimepro.ktor.dto.LoginRequest
import com.hellotimepro.ktor.dto.LogoutRequest
import com.hellotimepro.ktor.dto.RefreshRequest
import com.hellotimepro.ktor.dto.RegisterRequest
import com.hellotimepro.ktor.dto.StackInfo
import com.hellotimepro.ktor.dto.StackItem
import com.hellotimepro.ktor.dto.UpdateProfileRequest
import com.hellotimepro.ktor.dto.CapsuleSuggestionRequest
import com.hellotimepro.ktor.web.ApiException
import com.hellotimepro.ktor.web.ErrorCode
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.http.content.staticFiles
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.receive
import io.ktor.server.request.receiveNullable
import io.ktor.server.response.respond
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.io.File

fun main() {
    val config = AppConfig()
    Db.init(config)
    val components = AppComponents(config)
    embeddedServer(Netty, port = config.port, host = config.host) {
        module(components)
    }.start(wait = true)
}

fun Application.module(components: AppComponents) {
    val log = LoggerFactory.getLogger("com.hellotimepro.ktor.Application")

    install(ContentNegotiation) {
        json(
            Json {
                encodeDefaults = true
                explicitNulls = true
                ignoreUnknownKeys = true
            },
        )
    }

    install(CORS) {
        anyHost()
        allowHeaders { true }
        allowNonSimpleContentTypes = true
        listOf(
            io.ktor.http.HttpMethod.Get,
            io.ktor.http.HttpMethod.Post,
            io.ktor.http.HttpMethod.Put,
            io.ktor.http.HttpMethod.Patch,
            io.ktor.http.HttpMethod.Delete,
            io.ktor.http.HttpMethod.Options,
        ).forEach { allowMethod(it) }
    }

    install(StatusPages) {
        exception<ApiException> { call, cause ->
            call.respond(
                cause.status,
                ErrorEnvelope(message = cause.message, errorCode = cause.code.name, details = cause.details),
            )
        }
        // 请求体反序列化失败（坏 JSON / 缺必填字段）→ 422 VALIDATION_ERROR
        exception<BadRequestException> { call, _ ->
            call.respond(
                HttpStatusCode.UnprocessableEntity,
                ErrorEnvelope(
                    message = "字段校验失败",
                    errorCode = ErrorCode.VALIDATION_ERROR.name,
                    details = listOf(ErrorDetail("body", "请求体格式不合法")),
                ),
            )
        }
        exception<Throwable> { call, cause ->
            log.error("Unhandled error", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorEnvelope(
                    message = "服务器内部错误: ${cause::class.simpleName}",
                    errorCode = ErrorCode.INTERNAL_ERROR.name,
                ),
            )
        }
    }

    val repoRoot = File(components.config.repoRoot).absoluteFile.normalize()

    routing {
        // 静态资源：头像 / 技术栈图标（相对仓库根的 spec/ 目录）。
        staticFiles("/static/avatars", repoRoot.resolve("spec/avatars"))
        staticFiles("/static/icons", repoRoot.resolve("spec/icons"))

        registerRoutes(components)
    }
}

/** 统一成功响应外壳。 */
suspend inline fun <reified T> ApplicationCall.ok(data: T, status: HttpStatusCode = HttpStatusCode.OK) {
    respond(status, Envelope.ok(data))
}

private fun authHeader(call: ApplicationCall): String? = call.request.headers["Authorization"]

// 缺失才用默认值；存在但非整数 → 422（对齐 openapi 的 integer 约束，与 count 参数处理一致）。
private fun intParam(call: ApplicationCall, name: String, default: Int): Int {
    val raw = call.request.queryParameters[name] ?: return default
    return raw.toIntOrNull() ?: throw ApiException.validation("$name 必须是整数", name)
}

private fun pageOf(call: ApplicationCall): Int = intParam(call, "page", 1)

private fun pageSizeOf(call: ApplicationCall): Int = intParam(call, "pageSize", 20)

fun io.ktor.server.routing.Route.registerRoutes(c: AppComponents) {
    // ── Health / Avatars ───────────────────────────────────────────────
    get("/api/v1/health") {
        val isSqlite = c.config.isSqlite
        val summary =
            "基于 Kotlin + Ktor + Exposed 的服务端实现。Netty 引擎承载 HTTP，" +
                "kotlinx.serialization 负责 JSON 序列化，Exposed 提供类型安全的 SQL DSL，" +
                "HikariCP 管理连接池，同时支持 PostgreSQL 与 SQLite 双驱动。" +
                "针对跨库差异自定义了 Exposed 列类型（UUID / 时间戳按方言分流读写格式），" +
                "Postgres 路径用 SELECT ... FOR UPDATE 行锁保证收藏计数与 refresh token 轮转的并发一致性。" +
                "JWT（HS256）+ refresh token 轮转与家族吊销实现鉴权；手写字段校验对齐契约的正则与长度约束，" +
                "StatusPages 将业务异常统一转换为契约约定的错误响应外壳。"
        val items = listOf(
            StackItem("language", "Kotlin", KotlinVersion.CURRENT.toString(), "/static/icons/kotlin.svg"),
            StackItem("framework", "Ktor", "2.3.13", "/static/icons/ktor.svg"),
            StackItem("runtime", "JVM", System.getProperty("java.version") ?: "21", "/static/icons/java.svg"),
            StackItem(
                "database",
                if (isSqlite) "SQLite" else "PostgreSQL",
                if (isSqlite) "3" else "16",
                "/static/icons/${if (isSqlite) "sqlite" else "postgresql"}.svg",
            ),
        )
        val uptime = (System.currentTimeMillis() - c.startTime) / 1000
        call.ok(
            HealthData("ok", c.config.serviceName, c.config.serviceVersion, uptime, StackInfo("backend", summary, items)),
        )
    }

    get("/api/v1/avatars") { call.ok(c.avatarService.list()) }

    // ── Auth ───────────────────────────────────────────────────────────
    post("/api/v1/auth/register") {
        call.ok(c.authService.register(call.receive<RegisterRequest>()), HttpStatusCode.Created)
    }
    post("/api/v1/auth/login") {
        call.ok(c.authService.login(call.receive<LoginRequest>()))
    }
    post("/api/v1/auth/refresh") {
        call.ok(c.authService.refresh(call.receive<RefreshRequest>().refreshToken))
    }
    post("/api/v1/auth/logout") {
        val body = runCatching { call.receiveNullable<LogoutRequest>() }.getOrNull()
        c.authService.logout(body?.refreshToken)
        call.respond(HttpStatusCode.NoContent)
    }

    // ── Me ─────────────────────────────────────────────────────────────
    get("/api/v1/me") {
        val user = c.authContext.required(authHeader(call))
        call.ok(c.userService.toDto(user))
    }
    patch("/api/v1/me") {
        val user = c.authContext.required(authHeader(call))
        call.ok(c.userService.updateProfile(user, call.receive<UpdateProfileRequest>()))
    }
    post("/api/v1/me/password") {
        val user = c.authContext.required(authHeader(call))
        c.authService.changePassword(user, call.receive<ChangePasswordRequest>())
        call.respond(HttpStatusCode.NoContent)
    }
    get("/api/v1/me/capsules") {
        val user = c.authContext.required(authHeader(call))
        call.ok(c.plazaService.myCapsules(user, pageOf(call), pageSizeOf(call)))
    }
    delete("/api/v1/me/capsules/{id}") {
        val user = c.authContext.required(authHeader(call))
        c.capsuleService.deleteOwn(user, call.parameters["id"] ?: "")
        call.respond(HttpStatusCode.NoContent)
    }

    // ── Capsules ───────────────────────────────────────────────────────
    post("/api/v1/capsules") {
        val user = c.authContext.required(authHeader(call))
        call.ok(c.capsuleService.create(user, call.receive<CreateCapsuleRequest>()), HttpStatusCode.Created)
    }
    get("/api/v1/capsules/{code}") {
        val viewer = c.authContext.optional(authHeader(call))
        call.ok(c.capsuleService.getByCode(call.parameters["code"] ?: "", viewer?.id))
    }

    // ── Plaza ──────────────────────────────────────────────────────────
    get("/api/v1/plaza/capsules") {
        val viewer = c.authContext.optional(authHeader(call))
        val sort = call.request.queryParameters["sort"] ?: "new"
        val filter = call.request.queryParameters["filter"] ?: "all"
        val q = call.request.queryParameters["q"]
        call.ok(c.plazaService.plazaList(sort, filter, q, pageOf(call), pageSizeOf(call), viewer?.id))
    }
    get("/api/v1/plaza/capsules/{id}") {
        val viewer = c.authContext.optional(authHeader(call))
        call.ok(c.capsuleService.getPlazaDetail(call.parameters["id"] ?: "", viewer?.id))
    }

    // ── Favorites ──────────────────────────────────────────────────────
    get("/api/v1/me/favorites") {
        val user = c.authContext.required(authHeader(call))
        call.ok(c.plazaService.myFavorites(user, pageOf(call), pageSizeOf(call)))
    }
    post("/api/v1/me/favorites") {
        val user = c.authContext.required(authHeader(call))
        call.ok(c.favoriteService.addFavorite(user, call.receive<FavoriteRequest>().capsuleId))
    }
    delete("/api/v1/me/favorites/{capsuleId}") {
        val user = c.authContext.required(authHeader(call))
        c.favoriteService.removeFavorite(user, call.parameters["capsuleId"] ?: "")
        call.respond(HttpStatusCode.NoContent)
    }

    // ── AI 建议 / 推荐 ─────────────────────────────────────────────────
    post("/api/v1/capsule-suggestion") {
        call.ok(c.suggestionService.suggest(call.receive<CapsuleSuggestionRequest>()))
    }
    get("/api/v1/capsule-recommendations") {
        val countParam = call.request.queryParameters["count"]
        val count = if (countParam != null) {
            countParam.toIntOrNull()?.takeIf { it in 3..8 }
                ?: throw ApiException.validation("count 必须是 [3, 8] 范围内的整数", "count")
        } else {
            4
        }
        val locale = call.request.queryParameters["locale"] ?: "zh-CN"
        call.ok(c.recommendationService.getRecommendations(count, locale))
    }
}
