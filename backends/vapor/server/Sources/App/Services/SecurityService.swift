import Foundation
import Vapor

/// 密码哈希（Vapor 内置 bcrypt，兼容 seed 的 $2b$）与 JWT（HS256，手写编解码）
/// + refresh token 生成/哈希。
struct SecurityService: Sendable {
    let config: AppConfig

    private var key: SymmetricKey { SymmetricKey(data: Data(config.jwtSecret.utf8)) }

    // ── 密码 ───────────────────────────────────────────────────────────────

    func hashPassword(_ plain: String) throws -> String {
        try Bcrypt.hash(plain, cost: 10)
    }

    func verifyPassword(_ plain: String, hashed: String) -> Bool {
        (try? Bcrypt.verify(plain, created: hashed)) ?? false
    }

    // ── JWT HS256 ─────────────────────────────────────────────────────────
    // 标准 JWT 形态：base64url(header).base64url(payload).base64url(HMAC-SHA256)。
    // 不引第三方 JWT 库：HS256 签发/校验各 ~20 行，swift-crypto 即够。

    func createAccessToken(user: User, now: Date = Date()) -> String {
        let iat = Int(now.timeIntervalSince1970)
        let payload: JSON = .object([
            "sub": .string(user.id.uuidString.lowercased()),
            "nickname": .string(user.nickname),
            "avatarId": .string(user.avatarId),
            "iat": .int(iat),
            "exp": .int(iat + config.accessTokenTtlSeconds),
        ])
        let header = Self.base64url(Data(#"{"alg":"HS256","typ":"JWT"}"#.utf8))
        let body = Self.base64url((try? JSONEncoder().encode(payload)) ?? Data())
        let signingInput = "\(header).\(body)"
        let mac = HMAC<SHA256>.authenticationCode(for: Data(signingInput.utf8), using: key)
        return "\(signingInput).\(Self.base64url(Data(mac)))"
    }

    struct DecodeResult {
        let subject: String?
        let error: String?
    }

    /// 校验 access token。过期统一 error="access_token_expired"；其它非法 error="invalid_token"。
    func decodeAccessToken(_ token: String, now: Date = Date()) -> DecodeResult {
        let invalid = DecodeResult(subject: nil, error: "invalid_token")
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let signature = Self.base64urlDecode(String(parts[2])) else { return invalid }
        let signingInput = "\(parts[0]).\(parts[1])"
        guard HMAC<SHA256>.isValidAuthenticationCode(
            signature, authenticating: Data(signingInput.utf8), using: key
        ) else { return invalid }
        guard let payloadData = Self.base64urlDecode(String(parts[1])),
              let payload = try? JSONDecoder().decode(JSON.self, from: payloadData),
              let sub = payload["sub"]?.stringValue,
              let exp = payload["exp"]?.intValue else { return invalid }
        if exp <= Int(now.timeIntervalSince1970) {
            return DecodeResult(subject: nil, error: "access_token_expired")
        }
        return DecodeResult(subject: sub, error: nil)
    }

    // ── Refresh token ─────────────────────────────────────────────────────

    /// 不透明随机 256-bit base64url 字符串。
    func generateRefreshToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        var rng = SystemRandomNumberGenerator()
        for i in bytes.indices { bytes[i] = UInt8.random(in: .min ... .max, using: &rng) }
        return Self.base64url(Data(bytes))
    }

    /// 落库只存 SHA-256 hex，原文不落库。
    func hashRefreshToken(_ raw: String) -> String {
        SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    // ── base64url ─────────────────────────────────────────────────────────

    static func base64url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func base64urlDecode(_ s: String) -> Data? {
        var b64 = s.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64.append("=") }
        return Data(base64Encoded: b64)
    }
}
