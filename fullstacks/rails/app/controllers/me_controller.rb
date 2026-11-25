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
    render partial: "me/list_panel", status: @list_error ? :service_unavailable : :ok
  end

  def profile
  end

  def update_profile
    nickname = params[:nickname].to_s.strip
    avatar = params[:avatarId]
    if [nickname, avatar] == [@user.nickname, @user.avatar_id]
      return redirect_to me_profile_path, status: :see_other, flash: { info: "没有需要保存的修改" }
    end

    UserService.update_profile(@user, nickname: nickname, avatarId: avatar)
    redirect_to me_profile_path, status: :see_other, flash: { success: "资料已更新" }
  rescue ApiError => e
    @profile_error = e.message
    @nickname_taken = e.status == 409 && e.details&.any? { |detail| detail[:field] == "nickname" }
    respond_to do |format|
      format.turbo_stream do
        streams = [turbo_stream.update("profile-form-error", partial: "me/form_error", locals: { message: @profile_error })]
        if @nickname_taken
          streams << turbo_stream.replace("profile-nickname-state", partial: "me/nickname_taken", locals: { id: "profile-nickname-state" })
        end
        render turbo_stream: streams, status: :unprocessable_entity
      end
      format.html { render :profile, status: :unprocessable_entity }
    end
  end

  def password
    if params[:currentPassword].to_s.empty?
      @password_error = "请输入当前密码"
      return render_password_error
    end
    if params[:newPassword] != params[:confirmPassword]
      @confirm_error = "两次输入的新密码不一致"
      return render_password_error
    end

    AuthService.change_password(@user, currentPassword: params[:currentPassword], newPassword: params[:newPassword])
    clear_auth_cookies
    redirect_to login_path, status: :see_other, flash: { success: "密码已修改，请重新登录" }
  rescue ApiError => e
    @password_error = e.message
    render_password_error
  end

  private

  def render_password_error
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.update("password-form-error", partial: "me/form_error",
                                                 locals: { message: @password_error, confirm_error: @confirm_error }),
               status: :unprocessable_entity
      end
      format.html { render :profile, status: :unprocessable_entity }
    end
  end

  def load_list(tab)
    @tab = tab
    visible = Integer(params[:visible], exception: false) || PAGE_SIZE
    visible = [visible, 1].max
    service = tab == :created ? :my_capsules : :my_favorites
    result = PlazaService.public_send(service, current_user, 1, PAGE_SIZE, limit: visible)
    @items = result[:items]
    @total = result[:pagination][:total]
    @stats = PlazaService.my_stats(current_user)
  rescue ActiveRecord::ActiveRecordError => e
    Rails.logger.warn("个人列表读取失败：#{e.class}")
    @list_error = true
    @items = []
    @total = 0
    @stats ||= { created: 0, opened: 0, unopened: 0, inPlaza: 0, favoritesReceived: 0, favoritesGiven: 0 }
  end

  def load_profile
    @tab = :profile
    @user = current_user
    @stats = PlazaService.my_stats(@user)
  end
end
