# 把 spec/avatars 与 spec/icons 直接映射到 /static/* （头像 / 技术栈图标），无需复制进仓库。
# 对应 Spring MVC WebConfig 的资源映射。
class StaticAssetsController < ActionController::Base
  FILENAME = /\A[\w.-]+\.(svg|png)\z/

  def avatar = serve("avatars")
  def icon = serve("icons")

  private

  def serve(kind)
    name = params[:filename].to_s
    return head(:not_found) unless FILENAME.match?(name)

    path = File.join(AppConfig.repo_root, "spec", kind, name)
    return head(:not_found) unless File.file?(path)

    type = name.end_with?(".png") ? "image/png" : "image/svg+xml"
    send_file path, type: type, disposition: "inline"
  end
end
