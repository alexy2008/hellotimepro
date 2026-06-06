module Api
  module V1
    # /api/v1/* JSON 接口基类：统一响应外壳、Bearer 鉴权、业务异常 → 契约错误外壳。
    class BaseController < ActionController::API
      include AuthResolution

      # 不把 JSON body 包到根键下：契约直接读顶层字段（email/title/...）。
      wrap_parameters format: []

      # rescue_from 按「后注册先匹配」：StandardError 先注册作兜底，ApiError 后注册优先命中。
      rescue_from StandardError, with: :render_internal_error
      rescue_from ApiError, with: :render_api_error

      private

      def render_ok(data, status: :ok)
        render json: { success: true, data: data, message: nil, errorCode: nil }, status: status
      end

      def render_api_error(err)
        body = { success: false, data: nil, message: err.message, errorCode: err.code }
        body[:details] = err.details if err.details
        render json: body, status: err.status
      end

      def render_internal_error(err)
        Rails.logger.error("Unhandled error: #{err.class}: #{err.message}\n#{err.backtrace&.first(8)&.join("\n")}")
        render json: {
          success: false, data: nil,
          message: "服务器内部错误: #{err.class}", errorCode: "INTERNAL_ERROR"
        }, status: :internal_server_error
      end

      def auth_header
        request.headers["Authorization"]
      end

      def int_param(name, default)
        raw = request.query_parameters[name]
        return default if raw.nil? || raw.to_s.empty?

        Integer(raw, exception: false) || raise(ApiError.validation("#{name} 必须是整数", name))
      end

      def page_param = int_param("page", 1)
      def page_size_param = int_param("pageSize", 20)
    end
  end
end
