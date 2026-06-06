# 公开页面：广场（/）、开启（/open）、关于（/about）、按码查看胶囊（/c/:code）。
class PublicController < ApplicationController
  def index
    @sort = params[:sort].presence || "new"
    @filter = params[:filter].presence || "all"
    @q = params[:q]
    @page = [params[:page].to_i, 1].max
    load_plaza
  end

  # 广场网格 Turbo Frame（搜索 / 翻页时局部替换 #plaza-grid）。
  def plaza_grid
    @sort = params[:sort].presence || "new"
    @filter = params[:filter].presence || "all"
    @q = params[:q]
    @page = [params[:page].to_i, 1].max
    load_plaza
    render partial: "public/plaza_grid", locals: plaza_locals
  end

  def open
  end

  def about
    @frontend_stack = [
      { role: "enhancement", name: "Hotwire", version: "Turbo + Stimulus", iconUrl: nil },
      { role: "template", name: "ERB", version: "Rails View", iconUrl: nil },
      { role: "styling", name: "Tailwind CSS", version: "4", iconUrl: "/static/icons/tailwindcss.svg" },
    ]
    @frontend_summary =
      "基于 Rails ERB 服务端渲染页面，首屏由服务器直出完整 HTML，适合表单、列表与详情页这类内容型交互。" \
      "Hotwire 中的 Turbo 负责局部导航与 frame 更新，Stimulus 承担倒计时、复制、头像选择、8 位码输入、AI 灵感与表单时间同步等小型浏览器行为，" \
      "在不引入 SPA 状态层的前提下保留顺滑的局部刷新体验。Tailwind CSS v4 配合项目共享的 Design Tokens 和 cy-* 组件类，" \
      "让 Rails 全栈页面与其它前端、全栈实现保持同一套视觉语言。"
    @health = HealthMetadata.build
  end

  def capsule
    @capsule = CapsuleService.get_by_code(params[:code], current_user&.id)
  rescue ApiError
    render :capsule_missing, status: :not_found
  end

  private

  def load_plaza
    result = PlazaService.plaza_list(
      sort: @sort, filter: @filter, q: @q, page: @page, page_size: 15, viewer_id: current_user&.id,
    )
    @items = result[:items]
    @pagination = result[:pagination]
  rescue ApiError
    @items = []
    @pagination = { page: 1, pageSize: 15, total: 0, totalPages: 0 }
  end

  def plaza_locals
    { items: @items, pagination: @pagination, authenticated: authenticated?, sort: @sort, filter: @filter, q: @q }
  end
  helper_method :plaza_locals
end
