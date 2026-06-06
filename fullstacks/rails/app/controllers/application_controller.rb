class ApplicationController < ActionController::Base
  include CookieAuth

  helper_method :current_user, :authenticated?

  # 教学项目：不按 UA 拦截浏览器（避免误挡测试客户端）。
end
