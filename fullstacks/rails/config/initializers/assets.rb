# Be sure to restart your server when you modify this file.

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = "1.0"

repo = Rails.root.join("../..").expand_path
Rails.application.config.assets.paths << repo.join("spec/styles")
Rails.application.config.assets.paths << Rails.root.join("node_modules/@fontsource")

# Add additional assets to the asset load path.
# Rails.application.config.assets.paths << Emoji.images_path
