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
      get "plaza/capsules/:id", to: "plaza#show"

      post "capsule-suggestion", to: "ai#suggestion"
      get "capsule-recommendations", to: "ai#recommendations"
    end
  end

  # ── SSR 页面 ─────────────────────────────────────────────────────────────
  root "public#index"
  get "open", to: "public#open"
  get "about", to: "public#about"
  get "c/:code", to: "public#capsule", as: :capsule

  get "login", to: "auth_view#login"
  post "login", to: "auth_view#do_login"
  get "register", to: "auth_view#register"
  post "register", to: "auth_view#do_register"
  post "logout", to: "auth_view#logout"

  get "create", to: "create#new"
  post "create", to: "create#create"

  get "me/created", to: "me#created"
  get "me/favorites", to: "me#favorites"
  get "me/profile", to: "me#profile"

  # ── /ui/* Hotwire 片段 / 浏览器动作 ───────────────────────────────────────
  get "ui/plaza/grid", to: "public#plaza_grid"
  post "ui/capsules/:id/favorite-toggle", to: "ui#favorite_toggle"
  delete "ui/capsules/:id", to: "ui#withdraw"

  # ── 静态资源：头像 / 技术栈图标（映射到 spec/） ────────────────────────────
  get "static/avatars/:filename", to: "static_assets#avatar", constraints: { filename: /[\w.\-]+/ }, format: false
  get "static/icons/:filename", to: "static_assets#icon", constraints: { filename: /[\w.\-]+/ }, format: false

  get "up", to: "rails/health#show", as: :rails_health_check
end
