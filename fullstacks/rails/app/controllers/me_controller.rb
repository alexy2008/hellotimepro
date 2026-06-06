# 个人中心 SSR 页面：我创建的 / 我收藏的 / 账号设置。均需登录。
class MeController < ApplicationController
  before_action :require_login!

  def created
    result = PlazaService.my_capsules(current_user, page_num, 20)
    @items = result[:items]
    @pagination = result[:pagination]
  end

  def favorites
    result = PlazaService.my_favorites(current_user, page_num, 20)
    @items = result[:items]
    @pagination = result[:pagination]
  end

  def profile
    @user = current_user
    @avatars = AvatarService.list
  end

  private

  def page_num
    [params[:page].to_i, 1].max
  end
end
