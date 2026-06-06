require "json"

# 从 spec/avatars/catalog.json 加载内置头像目录（首次访问时一次，进程内缓存）。
module AvatarService
  module_function

  def list
    load!
    @avatars
  end

  def exists?(id)
    load!
    @ids.include?(id)
  end

  def load!
    return if defined?(@avatars) && @avatars

    path = File.join(AppConfig.repo_root, "spec", "avatars", "catalog.json")
    catalog = JSON.parse(File.read(path))
    @avatars = catalog.fetch("avatars").map do |a|
      {
        id: a["id"],
        name: a["name"],
        primaryColor: a["primaryColor"],
        svgUrl: a["svgUrl"],
      }
    end
    @ids = @avatars.map { |a| a[:id] }.to_set
  end
end
