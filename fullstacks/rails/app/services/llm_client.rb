require "net/http"
require "json"
require "uri"

# 结构化 JSON 生成的 LLM 客户端。日志规范、网关重试、CF 1010 等坑见 docs/dev-notes.md §3。
# 契约测试默认 LLM_ENABLED=false 时立即抛异常，由上层走本地兜底；HTTP 路径不在测试链上。
module LlmClient
  module_function

  class Error < StandardError
    attr_reader :status

    def initialize(message, status: 0)
      super(message)
      @status = status
    end
  end

  TRANSIENT = [
    Timeout::Error, Errno::ECONNRESET, Errno::ECONNREFUSED, Errno::EPIPE,
    EOFError, SocketError, IOError, OpenSSL::SSL::SSLError
  ].freeze

  def generate_capsule_suggestion(prompt)
    generate_structured_json(prompt, suggestion_spec)
  end

  def generate_capsule_recommendations(prompt)
    generate_structured_json(prompt, recommendation_spec)
  end

  def generate_structured_json(prompt, spec)
    raise Error.new("LLM is disabled or missing API key") if !AppConfig.llm_enabled || AppConfig.llm_api_key.empty?

    case AppConfig.llm_api_style
    when "responses" then generate_with_responses(prompt, spec)
    when "auto"
      begin
        generate_with_responses(prompt, spec)
      rescue Error => e
        Rails.logger.info("Responses API unavailable (#{e.message}); falling back to chat completions")
        generate_with_chat(prompt, spec, disable_thinking: true)
      end
    else
      generate_with_chat(prompt, spec, disable_thinking: true)
    end
  end

  def generate_with_responses(prompt, spec)
    payload = {
      model: AppConfig.llm_model,
      input: prompt,
      max_output_tokens: spec[:max_output_tokens],
      text: { format: { type: "json_schema", name: spec[:schema_name], strict: true, schema: spec[:schema] } },
    }
    parse_json_object(extract_responses_text(post_json(responses_url, payload)))
  end

  def generate_with_chat(prompt, spec, disable_thinking:)
    build = lambda do |thinking|
      p = {
        model: AppConfig.llm_model,
        messages: [
          { role: "system", content: spec[:system_prompt] },
          { role: "user", content: prompt },
        ],
        max_tokens: spec[:max_tokens],
      }
      p[:thinking] = { type: "disabled" } if thinking
      p
    end
    begin
      parse_json_object(extract_chat_text(post_json(chat_url, build.call(disable_thinking))))
    rescue Error => e
      raise e unless e.status == 400

      # 某些网关不认 thinking 字段，去掉重试一次。
      parse_json_object(extract_chat_text(post_json(chat_url, build.call(false))))
    end
  end

  # 向 url POST JSON；瞬时网络/TLS 错误按配置重试，HTTP 4xx/5xx 与坏 JSON 不重试。
  def post_json(url, payload)
    body = JSON.generate(payload)
    attempts = [1, AppConfig.llm_max_retries + 1].max
    last_error = nil
    uri = URI.parse(url)

    (1..attempts).each do |attempt|
      Rails.logger.info("LLM request  model=#{AppConfig.llm_model} url=#{url} attempt=#{attempt}/#{attempts}")
      start = now_ms
      begin
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = uri.scheme == "https"
        http.open_timeout = AppConfig.llm_timeout_ms / 1000.0
        http.read_timeout = AppConfig.llm_timeout_ms / 1000.0
        req = Net::HTTP::Post.new(uri)
        req["Authorization"] = "Bearer #{AppConfig.llm_api_key}"
        req["Content-Type"] = "application/json"
        req["Accept"] = "application/json"
        req["User-Agent"] = AppConfig.llm_user_agent
        req.body = body
        res = http.request(req)
        elapsed = now_ms - start
        status = res.code.to_i
        if status < 200 || status >= 300
          Rails.logger.warn("LLM error    model=#{AppConfig.llm_model} elapsed_ms=#{elapsed} status=#{status}")
          raise Error.new("HTTP #{status}: #{res.body}", status: status)
        end
        parsed = begin
          JSON.parse(res.body)
        rescue JSON::ParserError => e
          Rails.logger.warn("LLM error    model=#{AppConfig.llm_model} elapsed_ms=#{elapsed} error=invalid-json")
          raise Error.new("LLM response was not valid JSON")
        end
        Rails.logger.info("LLM response model=#{AppConfig.llm_model} elapsed_ms=#{elapsed} tokens=#{extract_tokens(parsed)}")
        return parsed
      rescue Error
        raise
      rescue *TRANSIENT => e
        elapsed = now_ms - start
        will_retry = attempt < attempts
        Rails.logger.warn("LLM error    model=#{AppConfig.llm_model} elapsed_ms=#{elapsed} error=#{e.message}#{will_retry ? ' (will retry)' : ''}")
        last_error = e
        sleep(AppConfig.llm_retry_backoff_ms * attempt / 1000.0) if will_retry
      end
    end
    raise Error.new(last_error&.message || "LLM request failed")
  end

  def extract_tokens(body)
    usage = body["usage"]
    return "n/a" unless usage.is_a?(Hash)

    total = usage["total_tokens"].to_i
    return total.to_s if total.positive?

    sum = usage["input_tokens"].to_i + usage["output_tokens"].to_i
    sum.positive? ? sum.to_s : "n/a"
  end

  def extract_chat_text(body)
    choices = body["choices"]
    raise Error.new("LLM chat response missing choices") unless choices.is_a?(Array) && choices.any?

    content = choices.dig(0, "message", "content")
    raise Error.new("LLM chat response missing content") if content.nil? || content.to_s.strip.empty?

    content
  end

  def extract_responses_text(body)
    ot = body["output_text"]
    return ot if ot.is_a?(String) && !ot.strip.empty?

    Array(body["output"]).each do |item|
      Array(item.is_a?(Hash) ? item["content"] : nil).each do |entry|
        txt = entry.is_a?(Hash) ? entry["text"] : nil
        return txt if txt.is_a?(String) && !txt.strip.empty?
      end
    end
    raise Error.new("LLM response did not contain output text")
  end

  def parse_json_object(raw)
    text = raw.to_s.strip
    if text.start_with?("```")
      text = text.sub(/\A```[a-zA-Z]*\s*/, "").sub(/\s*```\z/, "").strip
    end
    begin
      JSON.parse(text)
    rescue JSON::ParserError
      s = text.index("{")
      e = text.rindex("}")
      raise Error.new("LLM output was not valid JSON") if s.nil? || e.nil? || e <= s

      JSON.parse(text[s..e])
    end
  end

  def responses_url = "#{strip_slash(AppConfig.llm_base_url)}/responses"
  def chat_url = "#{strip_slash(AppConfig.llm_base_url)}/chat/completions"

  def strip_slash(v)
    v.to_s.strip.empty? ? "https://api.openai.com/v1" : v.sub(%r{/+\z}, "")
  end

  def now_ms = (Process.clock_gettime(Process::CLOCK_MONOTONIC) * 1000).to_i

  def suggestion_spec
    {
      schema_name: "capsule_suggestion",
      schema: {
        type: "object", additionalProperties: false,
        required: %w[title content openInDays],
        properties: {
          title: { type: "string" }, content: { type: "string" },
          openInDays: { type: "integer", minimum: 1, maximum: 3650 },
        },
      },
      system_prompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" \
                     "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。",
      max_output_tokens: 900, max_tokens: 900,
    }
  end

  def recommendation_spec
    {
      schema_name: "capsule_recommendations",
      schema: {
        type: "object", additionalProperties: false, required: %w[items],
        properties: {
          items: {
            type: "array", minItems: 3, maxItems: 8,
            items: {
              type: "object", additionalProperties: false,
              required: %w[title hint openInDays],
              properties: {
                title: { type: "string" }, hint: { type: "string" },
                openInDays: { type: "integer", minimum: 1, maximum: 3650 },
              },
            },
          },
        },
      },
      system_prompt: "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。" \
                     "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
      max_output_tokens: 900, max_tokens: 900,
    }
  end
end
