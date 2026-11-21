import SQLKit
import Vapor
import XCTest
@testable import App

final class StatsTests: XCTestCase {
    func testOpenAtUsesUtcCalendarYearsAndClampsLeapDay() {
        let now = IsoDate.parse("2028-03-01T01:30:45+08:00")!
        XCTAssertThrowsError(try Validation.openAt("2028-02-29T17:31:45Z", now: now))
        XCTAssertNoThrow(try Validation.openAt("2028-02-29T17:31:45.001Z", now: now))
        XCTAssertNoThrow(try Validation.openAt("2038-02-28T17:30:45Z", now: now))
        XCTAssertThrowsError(try Validation.openAt("2038-02-28T17:30:45.001Z", now: now))
    }

    func testPlazaCountsAndListShareLiteralSearch() async throws {
        try await withDatabase { db in
            let repository = CapsuleRepository(dbx: db)
            let plaza = PlazaService(db: db, capsules: repository, mapper: MapperService())
            let empty = try await plaza.plazaStats(q: nil)
            XCTAssertEqual(empty["counts"]?["all"]?.intValue, 0)
            XCTAssertEqual(try self.encoded(empty["farthestOpenAt"]), "null")
            XCTAssertEqual(try self.encoded(empty["nextOpenAt"]), "null")
            let owner = try await self.addUser(db, "Writer_One")
            let other = try await self.addUser(db, "WriterXOne")
            let now = Date(timeIntervalSince1970: Date().timeIntervalSince1970.rounded(.down))
            let next = now.addingTimeInterval(3600)
            let farthest = now.addingTimeInterval(7200)
            try await self.addCapsule(db, owner, title: "Report%_\\", openAt: now.addingTimeInterval(-3600), inPlaza: true)
            try await self.addCapsule(db, other, title: "Unrelated", openAt: next, inPlaza: true)
            try await self.addCapsule(db, other, title: "ReportXYZ", openAt: farthest, inPlaza: true)
            try await self.addCapsule(db, owner, title: "Report%_\\", openAt: now.addingTimeInterval(10800), inPlaza: false)
            for search in ["  REPORT%_\\  ", "\\", "%", "_", "WRITER_ONE"] {
                let stats = try await plaza.plazaStats(q: search)
                XCTAssertEqual(stats["farthestOpenAt"]?.stringValue, IsoDate.jsonString(farthest))
                XCTAssertEqual(stats["nextOpenAt"]?.stringValue, IsoDate.jsonString(next))
                for (filter, expected) in [("all", 1), ("opened", 1), ("unopened", 0)] {
                    let page = try await plaza.plazaList(sort: "new", filter: filter, q: search, page: 1, pageSize: 20, viewerId: nil)
                    XCTAssertEqual(stats["counts"]?[filter]?.intValue, expected)
                    XCTAssertEqual(page["pagination"]?["total"]?.intValue, expected)
                    XCTAssertEqual(page["items"]?.arrayValue?.count, expected)
                }
            }
        }
    }

    func testPrivateSelfFavoritesAndExplicitDelete() async throws {
        try await withDatabase { db in
            let capsuleRepo = CapsuleRepository(dbx: db)
            let favoriteRepo = FavoriteRepository(dbx: db)
            let plaza = PlazaService(db: db, capsules: capsuleRepo, mapper: MapperService())
            let capsules = CapsuleService(db: db, capsules: capsuleRepo, favorites: favoriteRepo, mapper: MapperService())
            let favorites = FavoriteService(db: db, capsules: capsuleRepo, favorites: favoriteRepo)
            let owner = try await self.addUser(db, "Owner")
            let viewer = try await self.addUser(db, "Viewer")
            let id = try await self.addCapsule(db, owner, title: "Private",
                                               openAt: Date().addingTimeInterval(3600), inPlaza: false)
            try await self.assertInvalidUUID { _ = try await capsules.getPlazaDetail("invalid", viewerId: nil) }
            try await self.assertInvalidUUID { try await capsules.deleteOwn(owner, "invalid") }
            try await self.assertInvalidUUID { try await favorites.removeFavorite(owner, "invalid") }
            try await self.assertInvalidUUID { _ = try await favorites.addFavorite(owner, "invalid") }
            let first = try await favorites.addFavorite(owner, id)
            let duplicate = try await favorites.addFavorite(owner, id)
            XCTAssertEqual(first["favoriteCount"]?.intValue, 1)
            XCTAssertEqual(first["favoritedAt"]?.stringValue, duplicate["favoritedAt"]?.stringValue)
            _ = try await favorites.addFavorite(viewer, id)
            let own = try await plaza.myCapsules(owner, page: 1, pageSize: 20)
            XCTAssertEqual(try self.encoded(own["items"]?.arrayValue?.first?["favoritedByMe"]), "true")
            XCTAssertEqual(try self.encoded(own["items"]?.arrayValue?.first?["favoritedAt"]), "null")
            let list = try await plaza.myFavorites(viewer, page: 1, pageSize: 20)
            XCTAssertEqual(try self.encoded(list["items"]?.arrayValue?.first?["inPlaza"]), "false")
            let owned = try await plaza.myStats(owner)
            XCTAssertEqual(owned["created"]?.intValue, 1)
            XCTAssertEqual(owned["inPlaza"]?.intValue, 0)
            XCTAssertEqual(owned["favoritesReceived"]?.intValue, 2)
            XCTAssertEqual(owned["favoritesGiven"]?.intValue, 1)
            try await capsules.deleteOwn(owner, id)
            for user in [owner, viewer] {
                let stats = try await plaza.myStats(user)
                for key in ["created", "opened", "unopened", "inPlaza", "favoritesReceived", "favoritesGiven"] {
                    XCTAssertEqual(stats[key]?.intValue, 0)
                }
            }
        }
    }

    private func assertInvalidUUID(_ operation: () async throws -> Void) async throws {
        do {
            try await operation()
            XCTFail("非法 UUID 未返回校验错误")
        } catch let error as ApiError {
            XCTAssertEqual(error.status, .unprocessableEntity)
            XCTAssertEqual(error.code, "VALIDATION_ERROR")
        }
    }

    private func encoded(_ value: JSON?) throws -> String? {
        try value.map { String(decoding: try JSONEncoder().encode($0), as: UTF8.self) }
    }

    private func addUser(_ db: AppDatabase, _ nickname: String) async throws -> User {
        let now = Date()
        let user = User(id: UUID(), email: "\(nickname.lowercased())@example.test", passwordHash: "test",
                        nickname: nickname, avatarId: "neo", createdAt: now, updatedAt: now)
        try await db.withSQL { sql in try await UserRepository(dbx: db).insert(sql, user) }
        return user
    }

    @discardableResult
    private func addCapsule(_ db: AppDatabase, _ user: User, title: String, openAt: Date, inPlaza: Bool) async throws -> String {
        let created = openAt.addingTimeInterval(-3600)
        let capsule = Capsule(id: UUID(), ownerId: user.id, code: CapsuleService.generateCode(), title: title,
                              content: "test", openAt: openAt, inPlaza: inPlaza, favoriteCount: 0,
                              createdAt: created, updatedAt: created)
        try await db.withSQL { sql in try await CapsuleRepository(dbx: db).insert(sql, capsule) }
        return capsule.id.uuidString
    }

    private func withDatabase(_ run: (AppDatabase) async throws -> Void) async throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../../../../..").standardizedFileURL
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let config = AppConfig(
            host: "127.0.0.1", port: 0, dbDriver: "sqlite",
            dbUrl: "sqlite:///\(folder.appendingPathComponent("test.db").path)", repoRoot: root.path,
            jwtSecret: "test-secret", accessTokenTtlSeconds: 3600,
            refreshTokenTtlSeconds: 604_800, loginRateLimitPerMinute: 10, llm: LlmConfig.fromEnvironment()
        )
        let app = try await Application.make(.testing)
        do {
            let db = try await AppDatabase(app: app, config: config)
            defer { db.shutdown() }
            let schema = try String(contentsOf: root.appendingPathComponent("spec/db/schema.sqlite.sql"), encoding: .utf8)
            try await db.withSQL { sql in
                for statement in schema.split(separator: ";").map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) })
                    where !statement.isEmpty {
                    var ddl: SQLQueryString = ""
                    ddl.appendLiteral(statement)
                    try await sql.raw(ddl).run()
                }
                try await sql.raw("PRAGMA foreign_keys = OFF").run()
            }
            try await run(db)
        } catch {
            try? await app.asyncShutdown()
            throw error
        }
        try await app.asyncShutdown()
    }
}
