module Api
  module V1
    class HealthController < BaseController
      def show
        render_ok(HealthMetadata.build)
      end
    end
  end
end
