# 登录 / 注册 / 登出页面（SSR 表单）。成功→设 cookie 后重定向；失败→422 重渲染（Turbo 显示错误）。
class AuthViewController < ApplicationController
  def login
    redirect_to("/me/created") and return if authenticated?

    @from = params[:from]
  end

  def do_login
    tokens = AuthService.login(email: params[:email], password: params[:password])
    set_auth_cookies(tokens)
    redirect_to(safe_from(params[:from]) || "/me/created")
  rescue ApiError => e
    @from = params[:from]
    @error = e.message
    @email = params[:email]
    render :login, status: :unprocessable_entity
  end

  def register
    redirect_to("/create") and return if authenticated?

    @avatars = AvatarService.list
  end

  def do_register
    tokens = AuthService.register(
      email: params[:email], password: params[:password],
      nickname: params[:nickname], avatarId: params[:avatarId],
    )
    set_auth_cookies(tokens)
    redirect_to("/create")
  rescue ApiError => e
    @avatars = AvatarService.list
    @error = e.message
    @email = params[:email]
    @nickname = params[:nickname]
    render :register, status: :unprocessable_entity
  end

  def logout
    AuthService.logout(cookies[:ht_refresh]) if cookies[:ht_refresh].present?
    clear_auth_cookies
    redirect_to("/")
  end

  private

  # 只接受站内相对路径，避免开放重定向。
  def safe_from(from)
    return nil if from.blank?

    from.start_with?("/") && !from.start_with?("//") ? from : nil
  end
end
