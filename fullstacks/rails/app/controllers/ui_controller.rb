# /ui/* 浏览器动作端点（cookie 鉴权）：收藏切换（返回 JSON）、撤回胶囊（Turbo Stream）。
class UiController < ApplicationController
  skip_forgery_protection # 同源 cookie 鉴权的轻量写操作；教学项目不做 CSRF token。

  # 收藏切换：已登录 → 切换并返回 {favorited, favoriteCount}；未登录 → 401（前端匿名分支本地拦截，不发请求）。
  def favorite_toggle
    user = current_user
    return render(json: { error: "unauthorized" }, status: :unauthorized) unless user

    id = CrossDb.parse_uuid_or_nil(params[:id])
    return render(json: { error: "not_found" }, status: :not_found) if id.nil?

    if Favorite.exists?(user_id: user.id, capsule_id: id)
      FavoriteService.remove_favorite(user, id)
      favorited = false
    else
      FavoriteService.add_favorite(user, id)
      favorited = true
    end
    count = Capsule.where(id: id).pick(:favorite_count) || 0
    render json: { favorited: favorited, favoriteCount: count }
  rescue ApiError => e
    render json: { error: e.code, message: e.message }, status: e.status
  end

  # 撤回（删除）自己创建的胶囊。
  def withdraw
    user = current_user
    return redirect_to("/login") unless user

    CapsuleService.delete_own(user, params[:id])
    respond_to do |format|
      format.turbo_stream { render turbo_stream: turbo_stream.remove("capsule-#{params[:id]}") }
      format.html { redirect_to("/me/created") }
    end
  rescue ApiError
    redirect_to("/me/created")
  end
end
