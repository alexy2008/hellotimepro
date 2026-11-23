class CreateController < ApplicationController
  before_action :require_login!

  def new
  end

  def create
    @capsule = CapsuleService.create(current_user, {
      title: params[:title], content: params[:content],
      openAt: params[:openAt], inPlaza: params[:inPlaza] == "true",
    })
    respond_to do |format|
      format.html { render :receipt, status: :created }
      format.turbo_stream do
        render turbo_stream: turbo_stream.update("creation-receipt", partial: "create/receipt", locals: { capsule: @capsule }),
               status: :created
      end
    end
  rescue ApiError => e
    @error = e.message
    respond_to do |format|
      format.turbo_stream { render json: { message: e.message, details: e.details }, status: e.status }
      format.html { render :new, status: :unprocessable_entity }
    end
  end
end
