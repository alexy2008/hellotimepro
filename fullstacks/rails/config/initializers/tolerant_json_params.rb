# 坏 JSON 请求体 → 解析为 {}（交给手写字段校验产出 422 VALIDATION_ERROR），
# 而非 Rails 默认的 400 ParseError（破坏统一响应外壳）。对齐其它栈的「坏 body → 422」。
ActionDispatch::Request.parameter_parsers[:json] = lambda do |raw|
  data = JSON.parse(raw)
  data.is_a?(Hash) ? data : { "_json" => data }
rescue JSON::ParserError
  {}
end
