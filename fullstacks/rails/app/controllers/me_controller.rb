class MeController < ApplicationController
  PAGE_SIZE = 20

  before_action :require_login!
  before_action :load_profile, only: %i[profile update_profile password]

  def index
    redirect_to me_created_path
  end

  def created
    load_list(:created)
    render :list
  end

  def favorites
    load_list(:favorites)
    render :list
  end

  def list_fragment
    tab = params[:tab]
    return head :not_found unless %w[created favorites].include?(tab)

    load_list(tab.to_sym)
    render partial: "me/list_panel"
  end

  def profile
  end

  def update_profile
    nickname, avatar = params.values_at(:nickname, :avatarId)
    if [nickname, avatar] == [@user.nickname, @user.avatar_id]
      return redirect_to me_profile_path, status: :see_other, flash: { info: "没有需要保存的修改" }
    end

    UserService.update_profile(@user, nickname: nickname, avatarId: avatar)
    redirect_to me_profile_path, status: :see_other, flash: { success: "资料已保存" }
  rescue ApiError => e
    @profile_error = e.message
    @nickname_taken = e.status == 409 && e.details&.any? { |detail| detail[:field] == "nickname" }
    render :profile, status: :unprocessable_entity
  end

  def password
    if params[:newPassword] != params[:confirmPassword]
      @confirm_error = "两次输入的新密码不一致"
      return render :profile, status: :unprocessable_entity
    end

    AuthService.change_password(@user, currentPassword: params[:currentPassword], newPassword: params[:newPassword])
    redirect_to me_profile_path, status: :see_other, flash: { success: "密码已修改" }
  rescue ApiError => e
    @password_error = e.message
    render :profile, status: :unprocessable_entity
  end

  private

  def load_list(tab)
    @tab = tab
    visible = Integer(params[:visible], exception: false) || PAGE_SIZE
    visible = [visible, 1].max
    service = tab == :created ? :my_capsules : :my_favorites
    result = PlazaService.public_send(service, current_user, 1, PAGE_SIZE, limit: visible)
    @items = result[:items]
    @total = result[:pagination][:total]
    @stats = PlazaService.my_stats(current_user)
  end

  def load_profile
    @tab = :profile
    @user = current_user
    @stats = PlazaService.my_stats(@user)
  end
end
