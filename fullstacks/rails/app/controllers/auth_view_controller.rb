class AuthViewController < ApplicationController
  before_action :check_signed_in, only: %i[login register]
  before_action :set_return_path, only: %i[login do_login register do_register]

  def login
  end

  def do_login
    tokens = AuthService.login(email: params[:email], password: params[:password])
    set_auth_cookies(tokens)
    redirect_to @return_path || me_created_path, status: :see_other, flash: { success: "欢迎回来，#{tokens[:user][:nickname]}" }
  rescue ApiError => e
    @error = e.status == 429 ? e.message : "邮箱或密码不正确"
    @email = params[:email]
    render :login, status: :unprocessable_entity
  end

  def register
  end

  def do_register
    nickname = params[:nickname].to_s.strip
    tokens = AuthService.register(
      email: params[:email], password: params[:password],
      nickname: nickname, avatarId: params[:avatarId],
    )
    set_auth_cookies(tokens)
    redirect_to @return_path || create_path, status: :see_other, flash: { success: "你好，#{tokens[:user][:nickname]}" }
  rescue ApiError => e
    @error = e.message
    @email = params[:email]
    @nickname = params[:nickname]
    @avatar_id = params[:avatarId]
    @nickname_taken = e.status == 409 && e.details&.any? { |detail| detail[:field] == "nickname" }
    render :register, status: :unprocessable_entity
  end

  def logout
    AuthService.logout(cookies[:ht_refresh]) if cookies[:ht_refresh].present?
    clear_auth_cookies
    redirect_to root_path, status: :see_other, flash: { success: "已登出" }
  end

  private

  def check_signed_in
    if authenticated?
      set_return_path
      redirect_to @return_path || me_created_path
    end
  end

  def set_return_path
    path = params[:redirect]
    return unless path.is_a?(String) && path.start_with?("/") && !path.start_with?("//")
    return if path.match?(/[\\\x00-\x20\x7f]/) || path.match?(%r{\A/(?:login|register)(?:[/?#]|\z)})

    @return_path = path
  end
end
