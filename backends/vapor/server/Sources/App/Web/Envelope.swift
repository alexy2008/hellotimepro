import Vapor

/// 统一响应外壳 `{ success, data, message, errorCode }`。
/// 成功响应的 message/errorCode 必须显式输出 null（契约 strict equal 断言）。
enum Envelope {
    static func ok(_ data: JSON, status: HTTPStatus = .ok) -> Response {
        json(.object([
            "success": .bool(true),
            "data": data,
            "message": .null,
            "errorCode": .null,
        ]), status: status)
    }

    static func error(
        _ status: HTTPStatus,
        code: String,
        message: String,
        details: [(field: String, message: String)]?
    ) -> Response {
        var body: [String: JSON] = [
            "success": .bool(false),
            "data": .null,
            "message": .string(message),
            "errorCode": .string(code),
        ]
        if let details, !details.isEmpty {
            body["details"] = .array(details.map {
                .object(["field": .string($0.field), "message": .string($0.message)])
            })
        }
        return json(.object(body), status: status)
    }

    static func noContent() -> Response {
        Response(status: .noContent)
    }

    private static func json(_ value: JSON, status: HTTPStatus) -> Response {
        let data = (try? JSONEncoder().encode(value)) ?? Data("{}".utf8)
        var headers = HTTPHeaders()
        headers.contentType = .json
        return Response(status: status, headers: headers, body: .init(data: data))
    }
}
