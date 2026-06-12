import XCTest
@testable import App

/// 无外部依赖的单元测试：校验规则 / 时间格式 / JWT 往返 / 跨库 UUID 转换。
/// （契约行为由 verification/contract 黑盒覆盖，这里只测纯函数层。）
final class UnitTests: XCTestCase {
    // ── IsoDate ───────────────────────────────────────────────────────────

    func testIsoDateParseVariants() {
        // JS toISOString（毫秒 + Z）
        XCTAssertNotNil(IsoDate.parse("2026-06-12T08:30:00.123Z"))
        // Python isoformat（微秒 + +00:00）
        XCTAssertNotNil(IsoDate.parse("2026-06-12T08:30:00.123456+00:00"))
        // 无小数秒
        XCTAssertNotNil(IsoDate.parse("2026-06-12T08:30:00Z"))
        // 空格分隔（旧数据容错）
        XCTAssertNotNil(IsoDate.parse("2026-06-12 08:30:00+00:00"))
        // 带时区偏移
        let d1 = IsoDate.parse("2026-06-12T16:30:00+08:00")!
        let d2 = IsoDate.parse("2026-06-12T08:30:00Z")!
        XCTAssertEqual(d1.timeIntervalSince1970, d2.timeIntervalSince1970, accuracy: 0.001)
        // 非法
        XCTAssertNil(IsoDate.parse("not-a-date"))
        XCTAssertNil(IsoDate.parse(""))
    }

    func testIsoDateRoundTrip() {
        let date = Date(timeIntervalSince1970: 1_780_000_000.123456)
        let sqlite = IsoDate.sqliteString(date)
        XCTAssertTrue(sqlite.hasSuffix("+00:00"))
        let parsed = IsoDate.parse(sqlite)!
        XCTAssertEqual(parsed.timeIntervalSince1970, date.timeIntervalSince1970, accuracy: 0.000_002)

        let json = IsoDate.jsonString(date)
        XCTAssertTrue(json.hasSuffix("Z"))
        XCTAssertNotNil(IsoDate.parse(json))
    }

    func testSqliteStringOrderingMatchesTime() {
        let base = Date()
        let earlier = IsoDate.sqliteString(base)
        let later = IsoDate.sqliteString(base.addingTimeInterval(0.02))
        XCTAssertLessThan(earlier, later, "相差 20ms 的时间戳必须保持字符串序")
    }

    // ── Validation ────────────────────────────────────────────────────────

    func testPasswordRule() {
        XCTAssertNoThrow(try Validation.password("password1234"))
        XCTAssertThrowsError(try Validation.password("short"))
        XCTAssertThrowsError(try Validation.password("alllettersonly"))
        XCTAssertThrowsError(try Validation.password("1234567890"))
    }

    func testNicknameRule() {
        XCTAssertNoThrow(try Validation.nickname("张三_01-x"))
        XCTAssertThrowsError(try Validation.nickname("!"))
        XCTAssertThrowsError(try Validation.nickname("a"))
        XCTAssertThrowsError(try Validation.nickname(String(repeating: "x", count: 21)))
    }

    func testEmailRule() {
        XCTAssertNoThrow(try Validation.email("USER@Example.COM "))
        XCTAssertThrowsError(try Validation.email("not-email"))
        XCTAssertThrowsError(try Validation.email(nil))
    }

    func testCodeRule() {
        XCTAssertNoThrow(try Validation.code("A1B2C3D4"))
        XCTAssertNoThrow(try Validation.code("a1b2c3d4"))
        XCTAssertThrowsError(try Validation.code("abc"))
    }

    // ── SecurityService（JWT / refresh token） ────────────────────────────

    private var security: SecurityService {
        SecurityService(config: AppConfig(
            host: "127.0.0.1", port: 0, dbDriver: "sqlite", dbUrl: nil, repoRoot: "../..",
            jwtSecret: "test-secret", accessTokenTtlSeconds: 3600,
            refreshTokenTtlSeconds: 604_800, loginRateLimitPerMinute: 10,
            llm: LlmConfig.fromEnvironment()
        ))
    }

    func testJwtRoundTrip() {
        let user = User(id: UUID(), email: "a@b.co", passwordHash: "x", nickname: "tester",
                        avatarId: "neo", createdAt: Date(), updatedAt: Date())
        let token = security.createAccessToken(user: user)
        XCTAssertEqual(token.split(separator: ".").count, 3)
        let decoded = security.decodeAccessToken(token)
        XCTAssertNil(decoded.error)
        XCTAssertEqual(decoded.subject, user.id.uuidString.lowercased())
    }

    func testJwtExpired() {
        let user = User(id: UUID(), email: "a@b.co", passwordHash: "x", nickname: "tester",
                        avatarId: "neo", createdAt: Date(), updatedAt: Date())
        let token = security.createAccessToken(user: user, now: Date(timeIntervalSinceNow: -7200))
        let decoded = security.decodeAccessToken(token)
        XCTAssertEqual(decoded.error, "access_token_expired")
    }

    func testJwtTampered() {
        XCTAssertEqual(security.decodeAccessToken("not-a-jwt").error, "invalid_token")
        let user = User(id: UUID(), email: "a@b.co", passwordHash: "x", nickname: "tester",
                        avatarId: "neo", createdAt: Date(), updatedAt: Date())
        let tampered = security.createAccessToken(user: user) + "x"
        XCTAssertEqual(security.decodeAccessToken(tampered).error, "invalid_token")
    }

    func testRefreshTokenShape() {
        let token = security.generateRefreshToken()
        XCTAssertGreaterThanOrEqual(token.count, 32)
        XCTAssertFalse(token.contains("="))
        XCTAssertEqual(security.hashRefreshToken(token).count, 64)
    }

    // ── 跨库 UUID ─────────────────────────────────────────────────────────

    func testUuidHexRoundTrip() {
        let u = UUID()
        let hex = AppDatabase.hex(u)
        XCTAssertEqual(hex.count, 32)
        XCTAssertEqual(AppDatabase.parseUuid(hex), u)
        XCTAssertEqual(AppDatabase.parseUuid(u.uuidString.lowercased()), u)
        XCTAssertNil(AppDatabase.parseUuid("zzz"))
    }

    // ── 推荐解析 ──────────────────────────────────────────────────────────

    func testRecommendationParseDedupAndClamp() {
        let raw: JSON = .array([
            .object(["title": .string("A"), "hint": .string("h1"), "openInDays": .int(30)]),
            .object(["title": .string("A"), "hint": .string("dup"), "openInDays": .int(60)]),
            .object(["title": .string("B"), "hint": .string("h2"), "openInDays": .int(99999)]),
            .object(["title": .string(""), "hint": .string("bad"), "openInDays": .int(1)]),
        ])
        let items = RecommendationService.parseItems(raw, limit: 8)
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[1]["openInDays"]?.intValue, 3650)
    }
}
