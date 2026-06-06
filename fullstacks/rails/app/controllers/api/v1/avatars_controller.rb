module Api
  module V1
    class AvatarsController < BaseController
      def index
        render_ok(AvatarService.list)
      end
    end
  end
end
