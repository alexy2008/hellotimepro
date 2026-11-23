class PublicController < ApplicationController
  def index
    load_plaza
    @overview = @q.blank? && !@plaza_error ? @stats : PlazaService.plaza_stats(q: nil)
    @featured = PlazaService.plaza_list(sort: "hot", filter: "unopened", q: nil,
                                       page: 1, page_size: 1, viewer_id: current_user&.id)[:items].first
  rescue ActiveRecord::ActiveRecordError => e
    log_plaza_error(e)
  end

  def plaza_grid
    load_plaza
    render partial: "public/plaza_grid", status: @plaza_error ? :service_unavailable : :ok
  end

  def open
    @recent = current_user ? PlazaService.my_capsules(current_user, 1, 3)[:items] : []
  end

  def about
  end

  def not_found
    render status: :not_found
  end

  def capsule
    load_capsule
  rescue ApiError => e
    render :capsule_missing, status: e.status == 422 ? :not_found : e.status
  rescue ActiveRecord::ActiveRecordError => e
    Rails.logger.error("胶囊详情读取失败：#{e.class}")
    render :capsule_error, status: :service_unavailable
  end

  def capsule_fragment
    load_capsule
    render partial: "public/capsule_body", locals: { capsule: @capsule }
  rescue ApiError => e
    head e.status
  end

  private

  def load_capsule
    @capsule = CapsuleService.get_by_code(params[:code], current_user&.id)
  end

  def load_plaza
    @sort = params[:sort].presence_in(%w[new hot]) || "new"
    @filter = params[:filter].presence_in(%w[all unopened opened]) || "all"
    @q = params[:q].to_s.strip
    @page = [params[:page].to_i, 1].max
    now = Time.now.utc
    @stats = PlazaService.plaza_stats(q: @q, now: now)
    result = PlazaService.plaza_list(sort: @sort, filter: @filter, q: @q, page: @page,
                                    page_size: 15, viewer_id: current_user&.id, now: now)
    @items = result[:items]
    @pagination = result[:pagination]
  rescue ApiError, ActiveRecord::ActiveRecordError => e
    log_plaza_error(e)
  end

  def log_plaza_error(error)
    Rails.logger.warn("广场读取失败：#{error.class}")
    @plaza_error = true
  end
end
