# 业务异常：由控制器 rescue_from 统一转换为契约约定的 ErrorEnvelope + HTTP 状态码。
class ApiError < StandardError
  attr_reader :code, :status, :details

  def initialize(code:, message:, status:, details: nil)
    super(message)
    @code = code
    @status = status
    @details = details
  end

  class << self
    def validation(message, field)
      new(code: "VALIDATION_ERROR", message: message, status: 422,
          details: [{ field: field, message: message }])
    end

    def unauthorized(message)
      new(code: "UNAUTHORIZED", message: message, status: 401)
    end

    def forbidden(message)
      new(code: "FORBIDDEN", message: message, status: 403)
    end

    def not_found(message)
      new(code: "NOT_FOUND", message: message, status: 404)
    end

    def conflict(message, field)
      new(code: "CONFLICT", message: message, status: 409,
          details: field ? [{ field: field, message: message }] : nil)
    end

    def bad_request(message)
      new(code: "BAD_REQUEST", message: message, status: 400)
    end

    def rate_limited(message)
      new(code: "RATE_LIMITED", message: message, status: 429)
    end
  end
end
