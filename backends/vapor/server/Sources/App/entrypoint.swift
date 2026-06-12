import Vapor

@main
struct Entrypoint {
    static func main() async throws {
        var env = try Environment.detect()
        try LoggingSystem.bootstrap(from: &env)

        let app = try await Application.make(env)
        do {
            try await configure(app)
        } catch {
            app.logger.report(error: error)
            try? await app.asyncShutdown()
            throw error
        }
        try await app.execute()
        try await app.asyncShutdown()
    }
}

func configure(_ app: Application) async throws {
    let config = AppConfig.fromEnvironment()
    app.http.server.configuration.hostname = config.host
    app.http.server.configuration.port = config.port
    app.http.client.configuration.timeout = .init(
        connect: .milliseconds(Int64(config.llm.timeoutMs)),
        read: .milliseconds(Int64(config.llm.timeoutMs))
    )

    // 替换默认中间件栈：CORS + 契约错误外壳（去掉默认 ErrorMiddleware 的输出格式）。
    app.middleware = .init()
    app.middleware.use(CORSMiddleware(configuration: .init(
        allowedOrigin: .all,
        allowedMethods: [.GET, .POST, .PUT, .PATCH, .DELETE, .OPTIONS],
        allowedHeaders: [.accept, .authorization, .contentType, .origin, .xRequestedWith]
    )))
    app.middleware.use(ApiErrorMiddleware())

    let db = try await AppDatabase(app: app, config: config)
    app.lifecycle.use(DatabaseShutdown(db: db))

    let components = try AppComponents(app: app, config: config, db: db)
    registerRoutes(app, components)

    app.logger.info("HelloTime Pro Vapor backend starting on \(config.host):\(config.port) (driver=\(config.dbDriver))")
}

/// 进程退出时回收连接池/连接。
private struct DatabaseShutdown: LifecycleHandler {
    let db: AppDatabase

    func shutdown(_ application: Application) {
        db.shutdown()
    }
}
