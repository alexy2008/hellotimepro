require "json"

# 从 spec/avatars/v2 加载目录与单线徽记，进程内缓存。
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

    path = File.join(directory, "catalog.json")
    catalog = JSON.parse(File.read(path))
    avatars = catalog.fetch("avatars").map do |a|
      {
        id: a["id"],
        name: a["name"],
        primaryColor: a["primaryColor"],
        svgUrl: a["svgUrl"],
      }
    end
    @captions = catalog.fetch("avatars").to_h { |avatar| [avatar["id"], avatar["tagline"]] }
    @ids = avatars.map { |a| a[:id] }.to_set
    @avatars = avatars
  end

  def caption(id)
    load!
    @captions[id]
  end

  def directory = File.join(AppConfig.repo_root, "spec", "avatars", "v2")

  def svg(id)
    @svg ||= list.to_h { |avatar| [avatar[:id], File.read(File.join(directory, "#{avatar[:id]}.svg"))] }
    @svg[id] || @svg.fetch("neo")
  end
end
