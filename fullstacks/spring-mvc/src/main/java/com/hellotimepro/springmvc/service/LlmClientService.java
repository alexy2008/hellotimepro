package com.hellotimepro.springmvc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellotimepro.springmvc.config.AppProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class LlmClientService {
  private static final Logger log = LoggerFactory.getLogger(LlmClientService.class);
  private final AppProperties props;
  private final ObjectMapper mapper;

  public LlmClientService(AppProperties props, ObjectMapper mapper) {
    this.props = props;
    this.mapper = mapper;
  }

  /** 结构化 JSON 生成的 schema 描述。 */
  public record SchemaSpec(
      String schemaName,
      Map<String, Object> schema,
      String systemPrompt,
      int maxOutputTokens,
      int maxTokens
  ) {}

  private static final SchemaSpec CAPSULE_SUGGESTION_SPEC = new SchemaSpec(
      "capsule_suggestion",
      Map.of(
          "type", "object",
          "additionalProperties", false,
          // strict 模式要求 required 覆盖全部 properties；空标题模式用 title，已带标题时忽略。
          "required", List.of("title", "content", "openInDays"),
          "properties", Map.of(
              "title", Map.of("type", "string"),
              "content", Map.of("type", "string"),
              "openInDays", Map.of("type", "integer", "minimum", 1, "maximum", 3650)
          )
      ),
      "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
          + "JSON 必须包含字符串字段 title、content 和整数字段 openInDays。若用户已给出标题，title 可原样回填。",
      900,
      900
  );

  private static final SchemaSpec CAPSULE_RECOMMENDATION_SPEC = new SchemaSpec(
      "capsule_recommendations",
      Map.of(
          "type", "object",
          "additionalProperties", false,
          "required", List.of("items"),
          "properties", Map.of(
              "items", Map.of(
                  "type", "array",
                  "minItems", 3,
                  "maxItems", 8,
                  "items", Map.of(
                      "type", "object",
                      "additionalProperties", false,
                      "required", List.of("title", "hint", "openInDays"),
                      "properties", Map.of(
                          "title", Map.of("type", "string"),
                          "hint", Map.of("type", "string"),
                          "openInDays", Map.of("type", "integer", "minimum", 1, "maximum", 3650)
                      )
                  )
              )
          )
      ),
      "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。"
          + "JSON 必须包含数组字段 items，每项含字符串字段 title、hint 和整数字段 openInDays。",
      900,
      900
  );

  /** 返回 {title: string, content: string, openInDays: int}。调用方负责解析。 */
  public JsonNode generateCapsuleSuggestion(String prompt) {
    return generateStructuredJson(prompt, CAPSULE_SUGGESTION_SPEC);
  }

  /** 返回 {items: [{title, hint, openInDays}]}。调用方负责解析。 */
  public JsonNode generateCapsuleRecommendations(String prompt) {
    return generateStructuredJson(prompt, CAPSULE_RECOMMENDATION_SPEC);
  }

  private JsonNode generateStructuredJson(String prompt, SchemaSpec spec) {
    var llm = props.getLlm();
    if (!llm.isEnabled() || llm.getApiKey() == null || llm.getApiKey().isBlank()) {
      throw new LlmClientException("LLM is disabled or missing API key");
    }

    // 按 api 风格路由：chat（默认，多数兼容网关只支持它，跳过 /responses）、responses、auto。
    String style = llm.getApiStyle() == null ? "chat" : llm.getApiStyle();
    if ("responses".equals(style)) {
      return generateWithResponses(prompt, spec);
    }
    if ("auto".equals(style)) {
      try {
        return generateWithResponses(prompt, spec);
      } catch (LlmClientException e) {
        log.info("Responses API unavailable ({}); falling back to chat completions", e.getMessage());
        return generateWithChatCompletions(prompt, spec);
      }
    }
    return generateWithChatCompletions(prompt, spec);
  }

  private JsonNode generateWithResponses(String prompt, SchemaSpec spec) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("model", props.getLlm().getModel());
    payload.put("input", prompt);
    payload.put("max_output_tokens", spec.maxOutputTokens());
    payload.put("text", Map.of("format", Map.of(
        "type", "json_schema",
        "name", spec.schemaName(),
        "strict", true,
        "schema", spec.schema()
    )));

    JsonNode body = postJson(responsesUrl(), payload);
    String text = extractResponsesText(body);
    return parseJsonNode(text);
  }

  private JsonNode generateWithChatCompletions(String prompt, SchemaSpec spec) {
    try {
      return generateWithChatCompletions(prompt, spec, true);
    } catch (LlmClientException e) {
      if (e.status != 400) {
        throw e;
      }
      return generateWithChatCompletions(prompt, spec, false);
    }
  }

  private JsonNode generateWithChatCompletions(String prompt, SchemaSpec spec, boolean disableThinking) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("model", props.getLlm().getModel());
    payload.put("messages", List.of(
        Map.of("role", "system", "content", spec.systemPrompt()),
        Map.of("role", "user", "content", prompt)
    ));
    payload.put("max_tokens", spec.maxTokens());
    if (disableThinking) {
      payload.put("thinking", Map.of("type", "disabled"));
    }

    JsonNode body = postJson(chatCompletionsUrl(), payload);
    String text = extractChatText(body);
    return parseJsonNode(text);
  }

  /**
   * 向 url POST JSON 载荷；对瞬时网络/TLS 错误（如 SSL EOF）按配置重试，
   * HTTP 4xx/5xx 等明确响应与坏 JSON 不重试。按 LLM 日志规范输出 request/response/error。
   */
  private JsonNode postJson(String url, Map<String, Object> payload) {
    var llm = props.getLlm();
    String model = String.valueOf(payload.getOrDefault("model", llm.getModel()));
    String body;
    try {
      body = mapper.writeValueAsString(payload);
    } catch (IOException e) {
      throw new LlmClientException("failed to serialize payload: " + e.getMessage(), e);
    }

    HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofMillis(llm.getTimeoutMs()))
        .build();
    int attempts = Math.max(1, llm.getMaxRetries() + 1);
    IOException lastIo = null;

    for (int attempt = 1; attempt <= attempts; attempt++) {
      log.info("LLM request  model={} url={} attempt={}/{}", model, url, attempt, attempts);
      long start = System.currentTimeMillis();
      try {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofMillis(llm.getTimeoutMs()))
            .header("Authorization", "Bearer " + llm.getApiKey())
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            // 避免被网关机器人防护按默认 UA 封禁（Cloudflare error 1010）
            .header("User-Agent", llm.getUserAgent())
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        long elapsed = System.currentTimeMillis() - start;
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
          // 服务端明确响应（含 Cloudflare 1010）——非瞬时错误，不重试
          log.warn("LLM error    model={} elapsed_ms={} status={}", model, elapsed, status);
          throw new LlmClientException("HTTP " + status + ": " + response.body(), status);
        }
        JsonNode parsed;
        try {
          parsed = mapper.readTree(response.body());
        } catch (IOException e) {
          log.warn("LLM error    model={} elapsed_ms={} error=invalid-json", model, elapsed);
          throw new LlmClientException("LLM response was not valid JSON", e);
        }
        log.info("LLM response model={} elapsed_ms={} tokens={}", model, elapsed, extractTokens(parsed));
        return parsed;
      } catch (IOException e) {
        // 瞬时网络/TLS 错误（含 SSL EOF）——在剩余次数内重试
        long elapsed = System.currentTimeMillis() - start;
        boolean willRetry = attempt < attempts;
        log.warn("LLM error    model={} elapsed_ms={} error={}{}",
            model, elapsed, e.getMessage(), willRetry ? " (will retry)" : "");
        lastIo = e;
        if (willRetry) {
          sleep((long) llm.getRetryBackoffMs() * attempt);
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new LlmClientException("LLM request interrupted", e);
      }
    }
    throw new LlmClientException(lastIo == null ? "LLM request failed" : lastIo.getMessage(), lastIo);
  }

  private String extractTokens(JsonNode body) {
    JsonNode usage = body.path("usage");
    if (usage.isMissingNode() || usage.isNull()) {
      return "n/a";
    }
    JsonNode total = usage.get("total_tokens");
    if (total != null && total.isNumber() && total.asLong() > 0) {
      return String.valueOf(total.asLong());
    }
    long sum = usage.path("input_tokens").asLong(0) + usage.path("output_tokens").asLong(0);
    return sum > 0 ? String.valueOf(sum) : "n/a";
  }

  private void sleep(long ms) {
    try {
      Thread.sleep(ms);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private String responsesUrl() {
    return stripTrailingSlash(props.getLlm().getBaseUrl()) + "/responses";
  }

  private String chatCompletionsUrl() {
    return stripTrailingSlash(props.getLlm().getBaseUrl()) + "/chat/completions";
  }

  private String stripTrailingSlash(String value) {
    if (value == null || value.isBlank()) {
      return "https://api.openai.com/v1";
    }
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }

  private String extractResponsesText(JsonNode body) {
    JsonNode outputText = body.get("output_text");
    if (outputText != null && outputText.isTextual() && !outputText.asText().isBlank()) {
      return outputText.asText();
    }

    JsonNode output = body.get("output");
    if (output != null && output.isArray()) {
      for (JsonNode item : output) {
        JsonNode content = item.get("content");
        if (content == null || !content.isArray()) {
          continue;
        }
        for (JsonNode entry : content) {
          JsonNode text = entry.get("text");
          if (text != null && text.isTextual() && !text.asText().isBlank()) {
            return text.asText();
          }
        }
      }
    }
    throw new LlmClientException("LLM response did not contain output text");
  }

  private String extractChatText(JsonNode body) {
    JsonNode choices = body.get("choices");
    if (choices == null || !choices.isArray() || choices.isEmpty()) {
      throw new LlmClientException("LLM chat response did not contain choices");
    }
    JsonNode content = choices.get(0).path("message").path("content");
    if (content.isTextual() && !content.asText().isBlank()) {
      return content.asText();
    }
    throw new LlmClientException("LLM chat response did not contain message content");
  }

  private JsonNode parseJsonNode(String raw) {
    String text = raw.strip();
    if (text.startsWith("```")) {
      text = text.replaceAll("^```[a-zA-Z]*\\s*", "").replaceAll("\\s*```$", "").strip();
    }
    try {
      return ensureObject(mapper.readTree(text));
    } catch (IOException first) {
      int start = text.indexOf('{');
      int end = text.lastIndexOf('}');
      if (start < 0 || end <= start) {
        throw new LlmClientException("LLM output was not valid JSON", first);
      }
      try {
        return ensureObject(mapper.readTree(text.substring(start, end + 1)));
      } catch (IOException second) {
        throw new LlmClientException("LLM output was not valid JSON", second);
      }
    }
  }

  private JsonNode ensureObject(JsonNode node) {
    if (!node.isObject()) {
      throw new LlmClientException("LLM output JSON was not an object");
    }
    return node;
  }

  public static class LlmClientException extends RuntimeException {
    private final int status;

    public LlmClientException(String message) {
      super(message);
      this.status = 0;
    }

    public LlmClientException(String message, Throwable cause) {
      super(message, cause);
      this.status = 0;
    }

    public LlmClientException(String message, int status) {
      super(message);
      this.status = status;
    }
  }
}
