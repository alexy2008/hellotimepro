import Foundation

/// 轻量 JSON 树：响应一律手工构造。
///
/// 选择它而不是 Codable 合成的原因：契约用 strict equal 断言 `data`/`errorCode`/`content`
/// 等字段为 **显式 null**，而 Swift 合成的 Encodable 对 Optional 走 `encodeIfPresent`
/// 直接省略键。JSON 枚举让 null 的输出完全可控。
/// 同时也用于解析 LLM 返回的任意 JSON。
enum JSON: Sendable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([JSON])
    case object([String: JSON])
}

extension JSON: Encodable {
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}

extension JSON: Decodable {
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Int.self) {
            self = .int(v)
        } else if let v = try? c.decode(Double.self) {
            self = .double(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([JSON].self) {
            self = .array(v)
        } else if let v = try? c.decode([String: JSON].self) {
            self = .object(v)
        } else {
            throw DecodingError.dataCorruptedError(in: c, debugDescription: "不支持的 JSON 值")
        }
    }
}

extension JSON {
    var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    /// 宽容取整：兼容 LLM 把 openInDays 输出成 30.0 或 "30" 的情况。
    var intValue: Int? {
        switch self {
        case .int(let v): return v
        case .double(let v): return Int(v)
        case .string(let v): return Int(v) ?? Double(v).map { Int($0) }
        default: return nil
        }
    }

    var arrayValue: [JSON]? {
        if case .array(let a) = self { return a }
        return nil
    }

    var objectValue: [String: JSON]? {
        if case .object(let o) = self { return o }
        return nil
    }

    subscript(_ key: String) -> JSON? { objectValue?[key] }

    /// Optional<String> → .string / .null
    static func from(_ s: String?) -> JSON { s.map { .string($0) } ?? .null }
}
