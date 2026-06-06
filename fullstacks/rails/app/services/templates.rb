# 读取仓库内 prompt 模板（缺失则空串，使用各服务内置默认模板）。
module Templates
  module_function

  def load(relative_path)
    path = File.join(AppConfig.repo_root, relative_path)
    File.exist?(path) ? File.read(path) : ""
  rescue StandardError
    ""
  end
end
