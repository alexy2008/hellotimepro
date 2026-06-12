import Vapor

/// 业务异常：由 ApiErrorMiddleware 统一转换为契约约定的 ErrorEnvelope + HTTP 状态码。
/// 对应 Ktor 的 ApiException。
struct ApiError: Error {
    let status: HTTPStatus
    let code: String
    let message: String
    let details: [(field: String, message: String)]?

    static func validation(_ message: String, _ field: String) -> ApiError {
        ApiError(status: .unprocessableEntity, code: "VALIDATION_ERROR", message: message,
                 details: [(field, message)])
    }

    static func unauthorized(_ message: String) -> ApiError {
        ApiError(status: .unauthorized, code: "UNAUTHORIZED", message: message, details: nil)
    }

    static func forbidden(_ message: String) -> ApiError {
        ApiError(status: .forbidden, code: "FORBIDDEN", message: message, details: nil)
    }

    static func notFound(_ message: String) -> ApiError {
        ApiError(status: .notFound, code: "NOT_FOUND", message: message, details: nil)
    }

    static func conflict(_ message: String, _ field: String? = nil) -> ApiError {
        ApiError(status: .conflict, code: "CONFLICT", message: message,
                 details: field.map { [($0, message)] })
    }

    static func badRequest(_ message: String) -> ApiError {
        ApiError(status: .badRequest, code: "BAD_REQUEST", message: message, details: nil)
    }

    static func rateLimited(_ message: String) -> ApiError {
        ApiError(status: .tooManyRequests, code: "RATE_LIMITED", message: message, details: nil)
    }
}

/// 替代 Vapor 默认 ErrorMiddleware：所有错误统一输出契约错误外壳。
final class ApiErrorMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        do {
            return try await next.respond(to: request)
        } catch let error as ApiError {
            return Envelope.error(error.status, code: error.code, message: error.message,
                                  details: error.details)
        } catch is DecodingError {
            // 请求体反序列化失败（坏 JSON / 字段类型不符）→ 422 VALIDATION_ERROR
            return Envelope.error(.unprocessableEntity, code: "VALIDATION_ERROR",
                                  message: "字段校验失败", details: [("body", "请求体格式不合法")])
        } catch let abort as AbortError {
            let code: String
            switch abort.status {
            case .notFound: code = "NOT_FOUND"
            case .unauthorized: code = "UNAUTHORIZED"
            default: code = abort.status.code >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST"
            }
            return Envelope.error(abort.status, code: code,
                                  message: abort.reason.isEmpty ? "请求失败" : abort.reason, details: nil)
        } catch {
            request.logger.error("Unhandled error: \(String(reflecting: error))")
            return Envelope.error(.internalServerError, code: "INTERNAL_ERROR",
                                  message: "服务器内部错误", details: nil)
        }
    }
}
