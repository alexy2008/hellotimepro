# 创建页 AI 推荐主题。锦上添花：LLM 不可用时返回空列表（不本地兜底、不报错）。
module CapsuleRecommendationService
  module_function

  MIN_ITEMS = 3
  MAX_ITEMS = 8

  DEFAULT_PROMPT = "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。" \
                   "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。" \
                   '只返回严格 JSON：{"items":[{"title":"...","hint":"...","openInDays":30}]}。'

  def get_recommendations(count, _locale)
    n = count.clamp(MIN_ITEMS, MAX_ITEMS)
    items = []
    begin
      node = LlmClient.generate_capsule_recommendations(build_prompt(n))
      items = parse_items(node["items"], n)
    rescue LlmClient::Error, ArgumentError => e
      Rails.logger.info("Capsule recommendations unavailable; returning empty list: #{e.message}")
    end
    generated_by = items.empty? ? "none" : "#{AppConfig.llm_provider}:#{AppConfig.llm_model}"
    { items: items, generatedBy: generated_by, cached: false }
  end

  def build_prompt(count)
    template = Templates.load("spec/llm/capsule-recommendation.prompt.md")
    template = DEFAULT_PROMPT if template.strip.empty?
    template.gsub("{COUNT}", count.to_s)
  end

  def parse_items(raw, limit)
    return [] unless raw.is_a?(Array)

    items = []
    seen = Set.new
    raw.each do |entry|
      next unless entry.is_a?(Hash)

      title = clean(entry["title"], 60)
      hint = clean(entry["hint"], 80)
      days = clamp_days(entry["openInDays"])
      next if title.empty? || hint.empty? || days.nil? || seen.include?(title)

      seen << title
      items << { title: title, hint: hint, openInDays: days }
      break if items.size >= limit
    end
    items
  end

  def clean(raw, limit)
    cleaned = raw.to_s.strip.gsub(/[\r\n]+/, " ")
    cleaned = cleaned.sub(/\A[#*`　 "'《》【】]+/, "").sub(/[#*`　 "'《》【】]+\z/, "").strip
    cleaned.length > limit ? cleaned[0, limit] : cleaned
  end

  def clamp_days(value)
    return nil if value.nil?

    n = value.is_a?(Integer) ? value : Integer(value.to_s, exception: false) || Float(value.to_s, exception: false)&.to_i
    n&.clamp(1, 3650)
  end
end
