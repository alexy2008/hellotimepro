import Foundation

/// 手写字段校验（与 spec/openapi.yaml 的正则/长度约束一致）。
/// 失败统一抛 VALIDATION_ERROR → 422。
enum Validation {
    private static let emailRe = regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
    private static let passwordRe = regex("^(?=.*[A-Za-z])(?=.*\\d).{8,128}$")
    private static let nicknameRe = regex("^[\\p{L}\\p{N}_-]{2,20}$")
    private static let avatarRe = regex("^[a-z0-9-]{2,20}$")
    private static let codeRe = regex("^[A-Za-z0-9]{8}$")

    private static func regex(_ pattern: String) -> NSRegularExpression {
        try! NSRegularExpression(pattern: pattern)
    }

    private static func matches(_ re: NSRegularExpression, _ s: String) -> Bool {
        re.firstMatch(in: s, options: [], range: NSRange(s.startIndex..., in: s)) != nil
    }

    @discardableResult
    static func email(_ value: String?) throws -> String {
        let e = value?.trimmingCharacters(in: .whitespaces) ?? ""
        guard !e.isEmpty, e.count <= 254, matches(emailRe, e) else {
            throw ApiError.validation("邮箱格式不正确", "email")
        }
        return e
    }

    @discardableResult
    static func requireNonBlank(_ value: String?, _ field: String) throws -> String {
        guard let v = value, !v.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw ApiError.validation("\(field) 不能为空", field)
        }
        return v
    }

    @discardableResult
    static func password(_ value: String?, _ field: String = "password") throws -> String {
        guard let v = value, matches(passwordRe, v) else {
            throw ApiError.validation("密码至少 8 位且需包含字母和数字", field)
        }
        return v
    }

    @discardableResult
    static func nickname(_ value: String?) throws -> String {
        guard let v = value, matches(nicknameRe, v) else {
            throw ApiError.validation("昵称需为 2-20 位字母/数字/下划线/连字符", "nickname")
        }
        return v
    }

    @discardableResult
    static func avatarFormat(_ value: String?) throws -> String {
        guard let v = value, matches(avatarRe, v) else {
            throw ApiError.validation("头像 ID 格式不正确", "avatarId")
        }
        return v
    }

    @discardableResult
    static func title(_ value: String?) throws -> String {
        guard let v = value, !v.isEmpty, v.count <= 60 else {
            throw ApiError.validation("标题长度需为 1-60", "title")
        }
        return v
    }

    @discardableResult
    static func content(_ value: String?) throws -> String {
        guard let v = value, !v.isEmpty, v.count <= 5000 else {
            throw ApiError.validation("内容长度需为 1-5000", "content")
        }
        return v
    }

    static func openAt(_ value: String?) throws -> Date {
        guard let v = value, !v.isEmpty else {
            throw ApiError.validation("openAt 不能为空", "openAt")
        }
        guard let date = IsoDate.parse(v) else {
            throw ApiError.validation("openAt 必须是 ISO-8601 时间", "openAt")
        }
        return date
    }

    @discardableResult
    static func code(_ value: String) throws -> String {
        guard matches(codeRe, value) else {
            throw ApiError.validation("code 必须为 8 位字母数字", "code")
        }
        return value
    }

    static func page(_ page: Int, _ pageSize: Int) throws {
        if page < 1 { throw ApiError.validation("page 必须 >= 1", "page") }
        if pageSize < 1 || pageSize > 50 { throw ApiError.validation("pageSize 范围 1-50", "pageSize") }
    }
}
