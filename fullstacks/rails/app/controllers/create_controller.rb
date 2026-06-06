# 创建胶囊页（SSR 表单 + Stimulus 增强：AI 推荐/生成、快速预设、本地时间→ISO）。
class CreateController < ApplicationController
  before_action :require_login!

  def new
  end

  def create
    detail = CapsuleService.create(current_user, {
      title: params[:title], content: params[:content],
      openAt: params[:openAt], inPlaza: params[:inPlaza] != "false",
    })
    redirect_to("/c/#{detail[:code]}")
  rescue ApiError => e
    @error = e.message
    @title = params[:title]
    @content = params[:content]
    @open_at = params[:openAt]
    @in_plaza = params[:inPlaza] != "false"
    render :new, status: :unprocessable_entity
  end
end
