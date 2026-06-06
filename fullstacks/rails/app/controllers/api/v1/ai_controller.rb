module Api
  module V1
    class AiController < BaseController
      def suggestion
        render_ok(CapsuleSuggestionService.suggest(title: params[:title], locale: params[:locale]))
      end

      def recommendations
        raw = request.query_parameters["count"]
        count =
          if raw.nil? || raw.to_s.empty?
            4
          else
            n = Integer(raw, exception: false)
            raise ApiError.validation("count 必须是 [3, 8] 范围内的整数", "count") if n.nil? || n < 3 || n > 8

            n
          end
        locale = request.query_parameters["locale"] || "zh-CN"
        render_ok(CapsuleRecommendationService.get_recommendations(count, locale))
      end
    end
  end
end
