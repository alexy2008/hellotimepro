module Api
  module V1
    class AuthController < BaseController
      def register
        tokens = AuthService.register(
          email: params[:email], password: params[:password],
          nickname: params[:nickname], avatarId: params[:avatarId],
        )
        render_ok(tokens, status: :created)
      end

      def login
        render_ok(AuthService.login(email: params[:email], password: params[:password]))
      end

      def refresh
        render_ok(AuthService.refresh(params[:refreshToken]))
      end

      def logout
        AuthService.logout(params[:refreshToken])
        head :no_content
      end
    end
  end
end
