Rails.application.routes.draw do
  # ── /api/v1 JSON 契约接口 ───────────────────────────────────────────────
  namespace :api do
    namespace :v1 do
      get "health", to: "health#show"
      get "avatars", to: "avatars#index"

      post "auth/register", to: "auth#register"
      post "auth/login", to: "auth#login"
      post "auth/refresh", to: "auth#refresh"
      post "auth/logout", to: "auth#logout"

      get "me", to: "me#show"
      get "me/stats", to: "me#stats"
      patch "me", to: "me#update"
      post "me/password", to: "me#change_password"
      get "me/capsules", to: "me#capsules"
      delete "me/capsules/:id", to: "me#delete_capsule"
      get "me/favorites", to: "me#favorites"
      post "me/favorites", to: "me#add_favorite"
      delete "me/favorites/:capsuleId", to: "me#remove_favorite"

      post "capsules", to: "capsules#create"
      get "capsules/:code", to: "capsules#show_by_code"

      get "plaza/capsules", to: "plaza#index"
      get "plaza/stats", to: "plaza#stats"
      get "plaza/capsules/:id", to: "plaza#show"

      post "capsule-suggestion", to: "ai#suggestion"
      get "capsule-recommendations", to: "ai#recommendations"
    end
  end

  # ── SSR 页面 ─────────────────────────────────────────────────────────────
  root "public#index"
  get "open", to: "public#open"
  get "about", to: "public#about"
  get "capsules/:code", to: "public#capsule", as: :capsule, format: false

  get "login", to: "auth_view#login"
  post "login", to: "auth_view#do_login"
  get "register", to: "auth_view#register"
  post "register", to: "auth_view#do_register"
  post "logout", to: "auth_view#logout"

  get "create", to: "create#new"
  post "create", to: "create#create"

  get "me", to: "me#index"
  get "me/created", to: "me#created"
  get "me/favorites", to: "me#favorites"
  get "me/profile", to: "me#profile"
  patch "me/profile", to: "me#update_profile"
  post "me/profile/password", to: "me#password", as: :profile_password

  # ── /ui/* Hotwire 片段 / 浏览器动作 ───────────────────────────────────────
  get "ui/plaza/grid", to: "public#plaza_grid"
  get "ui/capsules/:code", to: "public#capsule_fragment", as: :capsule_fragment, format: false
  get "ui/me/:tab", to: "me#list_fragment", as: :me_fragment, format: false

  # ── 静态资源：头像 / 技术栈图标（映射到 spec/） ────────────────────────────
  get "static/avatars/:filename", to: "static_assets#avatar", constraints: { filename: /[\w.\-]+/ }, format: false
  get "static/icons/:filename", to: "static_assets#icon", constraints: { filename: /[\w.\-]+/ }, format: false

  get "up", to: "rails/health#show", as: :rails_health_check
  get "*path", to: "public#not_found", format: false
end
