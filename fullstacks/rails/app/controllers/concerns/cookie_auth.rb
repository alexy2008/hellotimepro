require "cgi"

# SSR 端登录态：用 httpOnly cookie（ht_access / ht_refresh）承载 token，服务器按 cookie 渲染。
# 只在 access 缺失/过期时才用 refresh 轮换一次（access JWT 自带 1h 有效期，导航不轮换），
# 规避「每次导航急切刷新 → 重用检测 → 整族吊销 → 误登出」的坑（见 docs/dev-notes.md §2 / §3.7）。
module CookieAuth
  extend ActiveSupport::Concern

  def current_user
    return @current_user if defined?(@current_user)

    @current_user = resolve_current_user
  end

  def authenticated?
    current_user.present?
  end

  def set_auth_cookies(tokens)
    cookies[:ht_access] = cookie_opts(tokens[:accessToken])
    cookies[:ht_refresh] = cookie_opts(tokens[:refreshToken])
  end

  def clear_auth_cookies
    cookies.delete(:ht_access, path: "/")
    cookies.delete(:ht_refresh, path: "/")
  end

  def require_login!
    return if authenticated?

    redirect_to("/login?from=#{CGI.escape(request.fullpath)}")
  end

  private

  def cookie_opts(value)
    { value: value, httponly: true, path: "/", same_site: :lax }
  end

  def resolve_current_user
    access = cookies[:ht_access]
    if access.present?
      decoded = SecurityService.decode_access_token(access)
      if decoded.subject
        id = CrossDb.parse_uuid_or_nil(decoded.subject)
        user = id && User.find_by(id: id)
        return user if user
      elsif decoded.error == "access_token_expired"
        return refresh_session
      end
    end
    cookies[:ht_refresh].present? ? refresh_session : nil
  end

  def refresh_session
    refresh = cookies[:ht_refresh]
    return nil if refresh.blank?

    tokens = AuthService.refresh(refresh)
    set_auth_cookies(tokens)
    User.find_by(id: tokens[:user][:id])
  rescue ApiError
    clear_auth_cookies
    nil
  end
end
