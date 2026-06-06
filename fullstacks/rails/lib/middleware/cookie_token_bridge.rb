require "cgi"

# cookie → Bearer 桥：对 /api/v1/* 请求，若缺 Authorization 头但带 ht_access cookie，
# 注入 "Bearer <ht_access>"，让浏览器 fetch（自动带 cookie）复用同一套 Bearer 鉴权控制器。
# 仅在缺 Authorization 头时介入：契约黑盒测试发真实 Bearer 头时不动手，「无鉴权 → 401」用例不受影响。
# 对应 Spring MVC 的 CookieTokenFilter。
class CookieTokenBridge
  def initialize(app)
    @app = app
  end

  def call(env)
    path = env["PATH_INFO"].to_s
    if path.start_with?("/api/v1/") && env["HTTP_AUTHORIZATION"].to_s.empty?
      token = extract_cookie(env["HTTP_COOKIE"], "ht_access")
      env["HTTP_AUTHORIZATION"] = "Bearer #{token}" if token && !token.empty?
    end
    @app.call(env)
  end

  private

  def extract_cookie(header, name)
    return nil if header.nil?

    header.split(/;\s*/).each do |pair|
      k, v = pair.split("=", 2)
      return CGI.unescape(v.to_s) if k == name
    end
    nil
  end
end
