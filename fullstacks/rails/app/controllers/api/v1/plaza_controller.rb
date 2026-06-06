module Api
  module V1
    class PlazaController < BaseController
      def index
        viewer = optional_user(auth_header)
        result = PlazaService.plaza_list(
          sort: request.query_parameters["sort"] || "new",
          filter: request.query_parameters["filter"] || "all",
          q: request.query_parameters["q"],
          page: page_param, page_size: page_size_param, viewer_id: viewer&.id,
        )
        render_ok(result)
      end

      def show
        viewer = optional_user(auth_header)
        render_ok(CapsuleService.get_plaza_detail(params[:id], viewer&.id))
      end
    end
  end
end
