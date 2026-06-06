module Api
  module V1
    class CapsulesController < BaseController
      def create
        user = require_user!(auth_header)
        detail = CapsuleService.create(user, {
          title: params[:title], content: params[:content],
          openAt: params[:openAt], inPlaza: params[:inPlaza],
        })
        render_ok(detail, status: :created)
      end

      def show_by_code
        viewer = optional_user(auth_header)
        render_ok(CapsuleService.get_by_code(params[:code], viewer&.id))
      end
    end
  end
end
