module Api
  module V1
    class MeController < BaseController
      def show
        user = require_user!(auth_header)
        render_ok(UserService.to_dto(user))
      end

      def update
        user = require_user!(auth_header)
        # nickname / avatarId 二者可选；未传的键不应被当成显式 nil（区分「不改」与「改」）。
        patch = {}
        patch[:nickname] = params[:nickname] if params.key?(:nickname)
        patch[:avatarId] = params[:avatarId] if params.key?(:avatarId)
        render_ok(UserService.update_profile(user, patch))
      end

      def change_password
        user = require_user!(auth_header)
        AuthService.change_password(user, currentPassword: params[:currentPassword], newPassword: params[:newPassword])
        head :no_content
      end

      def capsules
        user = require_user!(auth_header)
        render_ok(PlazaService.my_capsules(user, page_param, page_size_param))
      end

      def delete_capsule
        user = require_user!(auth_header)
        CapsuleService.delete_own(user, params[:id])
        head :no_content
      end

      def favorites
        user = require_user!(auth_header)
        render_ok(PlazaService.my_favorites(user, page_param, page_size_param))
      end

      def add_favorite
        user = require_user!(auth_header)
        render_ok(FavoriteService.add_favorite(user, params[:capsuleId]))
      end

      def remove_favorite
        user = require_user!(auth_header)
        FavoriteService.remove_favorite(user, params[:capsuleId])
        head :no_content
      end
    end
  end
end
