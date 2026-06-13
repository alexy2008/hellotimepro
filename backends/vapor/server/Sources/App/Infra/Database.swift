import Vapor
import SQLKit
import PostgresKit
import SQLiteKit
import NIOCore
import Foundation

/// 跨库数据访问入口：把 PostgreSQL（连接池）与 SQLite（单连接 + 串行门闩）
/// 统一为 `withSQL` / `transaction` 两个原语，业务层只面对 SQLKit 的 `SQLDatabase`。
///
/// - **PostgreSQL**：EventLoopGroupConnectionPool，事务用 BEGIN/COMMIT 包裹同一连接。
/// - **SQLite**：单连接 + FIFO 门闩串行化全部访问，
///   避免多连接写竞争出现 database is locked。
/// - 每个 service 公共方法应只调用一次 withSQL/transaction，保证多步操作原子，
///   且不可嵌套（SQLite 门闩不可重入）。
final class AppDatabase: @unchecked Sendable {
    let isSqlite: Bool
    private let logger = Logger(label: "app.database")
    private let eventLoopGroup: EventLoopGroup
    private var pgPool: EventLoopGroupConnectionPool<PostgresConnectionSource>?
    private var sqliteConnection: SQLiteConnection?
    private let sqliteGate = AsyncGate()

    init(app: Application, config: AppConfig) async throws {
        self.eventLoopGroup = app.eventLoopGroup
        self.isSqlite = config.isSqlite

        if isSqlite {
            let path = Self.sqlitePath(config: config)
            FileManager.default.createDirectoryIfNeeded(atPath: (path as NSString).deletingLastPathComponent)
            let conn = try await SQLiteConnection.open(
                storage: .file(path: path),
                threadPool: app.threadPool,
                on: app.eventLoopGroup.any()
            ).get()
            // busy_timeout 兜底（理论上单连接不会触发）；外键约束按 schema 启用。
            _ = try await conn.query("PRAGMA busy_timeout = 5000", []).get()
            _ = try await conn.query("PRAGMA foreign_keys = ON", []).get()
            self.sqliteConnection = conn
        } else {
            let pgConfig = Self.postgresConfiguration(config: config)
            self.pgPool = EventLoopGroupConnectionPool(
                source: PostgresConnectionSource(sqlConfiguration: pgConfig),
                maxConnectionsPerEventLoop: 2,
                on: app.eventLoopGroup
            )
        }
    }

    func shutdown() {
        pgPool?.shutdown()
        try? sqliteConnection?.close().wait()
    }

    /// 在一个连接上执行若干语句（无显式事务）。
    func withSQL<T: Sendable>(_ body: @escaping @Sendable (any SQLDatabase) async throws -> T) async throws -> T {
        if isSqlite {
            await sqliteGate.acquire()
            do {
                let result = try await body(sqliteConnection!.sql())
                await sqliteGate.release()
                return result
            } catch {
                await sqliteGate.release()
                throw error
            }
        }
        return try await pgPool!.withConnection(logger: logger, on: eventLoopGroup.any()) { conn in
            let promise = conn.eventLoop.makePromise(of: T.self)
            promise.completeWithTask { try await body(conn.sql()) }
            return promise.futureResult
        }.get()
    }

    /// 在一个连接上执行事务（BEGIN/COMMIT，异常 ROLLBACK）。
    func transaction<T: Sendable>(_ body: @escaping @Sendable (any SQLDatabase) async throws -> T) async throws -> T {
        let isSqlite = self.isSqlite
        return try await withSQL { sql in
            if isSqlite {
                try await sql.raw("BEGIN IMMEDIATE").run()
            } else {
                try await sql.raw("BEGIN").run()
            }
            do {
                let result = try await body(sql)
                try await sql.raw("COMMIT").run()
                return result
            } catch {
                try? await sql.raw("ROLLBACK").run()
                throw error
            }
        }
    }

    // ── 连接配置 ───────────────────────────────────────────────────────────

    private static func sqlitePath(config: AppConfig) -> String {
        if let url = config.dbUrl, url.hasPrefix("sqlite:///") {
            return String(url.dropFirst("sqlite:///".count - 1)) // 保留前导 /
        }
        return config.absRepoRoot + "/data/sqlite/hellotime-vapor.db"
    }

    /// 解析 `postgresql://user:pass@host:port/db`（也接受 postgres:// 前缀）。
    private static func postgresConfiguration(config: AppConfig) -> SQLPostgresConfiguration {
        var host = "127.0.0.1"
        var port = 5432
        var user = "hellotime"
        var pass = "hellotime"
        var dbName = "hellotime_pro"

        if let raw = config.dbUrl, let schemeEnd = raw.range(of: "://") {
            let rest = String(raw[schemeEnd.upperBound...])
            let credsAndHost: (creds: String?, hostPart: String)
            if let at = rest.range(of: "@", options: .backwards) {
                credsAndHost = (String(rest[..<at.lowerBound]), String(rest[at.upperBound...]))
            } else {
                credsAndHost = (nil, rest)
            }
            if let creds = credsAndHost.creds {
                let parts = creds.split(separator: ":", maxSplits: 1).map(String.init)
                if let u = parts.first, !u.isEmpty { user = u }
                if parts.count > 1 { pass = parts[1] }
            }
            let hostPart = credsAndHost.hostPart
            let hostPort = hostPart.split(separator: "/", maxSplits: 1).map(String.init)
            if let hp = hostPort.first {
                let pieces = hp.split(separator: ":", maxSplits: 1).map(String.init)
                if let h = pieces.first, !h.isEmpty { host = h }
                if pieces.count > 1, let p = Int(pieces[1]) { port = p }
            }
            if hostPort.count > 1 {
                dbName = hostPort[1].split(separator: "?", maxSplits: 1).map(String.init).first ?? dbName
            }
        }

        return SQLPostgresConfiguration(
            hostname: host, port: port,
            username: user, password: pass,
            database: dbName, tls: .disable
        )
    }
}

// ── 跨库值编解码 ───────────────────────────────────────────────────────────
// SQLite：UUID 存 32 位无横线 hex TEXT、时间戳存 ISO-8601 TEXT、布尔存 0/1；
// Postgres：原生 uuid / timestamptz / boolean。与 seed 及其它栈完全对齐。

extension AppDatabase {
    func uuidValue(_ u: UUID) -> any Encodable & Sendable {
        isSqlite ? Self.hex(u) : u
    }

    func dateValue(_ d: Date) -> any Encodable & Sendable {
        isSqlite ? IsoDate.sqliteString(d) : d
    }

    func boolValue(_ b: Bool) -> any Encodable & Sendable {
        isSqlite ? (b ? 1 : 0) : b
    }

    func uuid(_ row: SQLRow, _ column: String) throws -> UUID {
        if isSqlite {
            let s = try row.decode(column: column, as: String.self)
            guard let u = Self.parseUuid(s) else {
                throw ApiError(status: .internalServerError, code: "INTERNAL_ERROR",
                               message: "非法 UUID 列值: \(column)", details: nil)
            }
            return u
        }
        return try row.decode(column: column, as: UUID.self)
    }

    func date(_ row: SQLRow, _ column: String) throws -> Date {
        if isSqlite {
            let s = try row.decode(column: column, as: String.self)
            guard let d = IsoDate.parse(s) else {
                throw ApiError(status: .internalServerError, code: "INTERNAL_ERROR",
                               message: "非法时间列值: \(column)", details: nil)
            }
            return d
        }
        return try row.decode(column: column, as: Date.self)
    }

    func dateOrNil(_ row: SQLRow, _ column: String) throws -> Date? {
        if try row.decodeNil(column: column) { return nil }
        return try date(row, column)
    }

    func bool(_ row: SQLRow, _ column: String) throws -> Bool {
        if isSqlite {
            return try row.decode(column: column, as: Int.self) != 0
        }
        return try row.decode(column: column, as: Bool.self)
    }

    static func hex(_ u: UUID) -> String {
        u.uuidString.replacingOccurrences(of: "-", with: "").lowercased()
    }

    /// 宽松解析 UUID：接受 32 位 hex 或 36 位带横线；非法返回 nil（调用方据此转 404）。
    static func parseUuid(_ raw: String) -> UUID? {
        let s = raw.trimmingCharacters(in: .whitespaces)
        if s.count == 32, s.allSatisfy({ $0.isHexDigit }) {
            var dashed = ""
            for (i, ch) in s.enumerated() {
                if i == 8 || i == 12 || i == 16 || i == 20 { dashed.append("-") }
                dashed.append(ch)
            }
            return UUID(uuidString: dashed)
        }
        return UUID(uuidString: s)
    }
}

/// FIFO 异步互斥：SQLite 全部访问串行化。
actor AsyncGate {
    private var busy = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func acquire() async {
        if !busy {
            busy = true
            return
        }
        await withCheckedContinuation { waiters.append($0) }
    }

    func release() {
        if waiters.isEmpty {
            busy = false
        } else {
            waiters.removeFirst().resume()
        }
    }
}

private extension FileManager {
    func createDirectoryIfNeeded(atPath path: String) {
        if !fileExists(atPath: path) {
            try? createDirectory(atPath: path, withIntermediateDirectories: true)
        }
    }
}
