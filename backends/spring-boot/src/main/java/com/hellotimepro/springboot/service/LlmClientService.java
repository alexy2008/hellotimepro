package com.hellotimepro.springboot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellotimepro.springboot.config.AppProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class LlmClientService {
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

  private static final SchemaSpec STACK_NARRATION_SPEC = new SchemaSpec(
      "stack_narration",
      Map.of(
          "type", "object",
          "additionalProperties", false,
          "required", List.of("title", "narrative"),
          "properties", Map.of(
              "title", Map.of("type", "string"),
              "narrative", Map.of("type", "string")
          )
      ),
      "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。JSON 必须包含字符串字段 title 和 narrative。",
      600,
      600
  );

  private static final SchemaSpec CAPSULE_SUGGESTION_SPEC = new SchemaSpec(
      "capsule_suggestion",
      Map.of(
          "type", "object",
          "additionalProperties", false,
          "required", List.of("content", "openInDays"),
          "properties", Map.of(
              "content", Map.of("type", "string"),
              "openInDays", Map.of("type", "integer", "minimum", 1, "maximum", 3650)
          )
      ),
      "你只返回严格 JSON 对象，不要 Markdown、代码块或解释。JSON 必须包含字符串字段 content 和整数字段 openInDays。",
      900,
      900
  );

  public Map<String, String> generateStructuredNarration(String prompt) {
    JsonNode node = generateStructuredJson(prompt, STACK_NARRATION_SPEC);
    return Map.of(
        "title", node.path("title").asText(""),
        "narrative", node.path("narrative").asText("")
    );
  }

  /** 返回 {content: string, openInDays: int}。调用方负责解析。 */
  public JsonNode generateCapsuleSuggestion(String prompt) {
    return generateStructuredJson(prompt, CAPSULE_SUGGESTION_SPEC);
  }

  private JsonNode generateStructuredJson(String prompt, SchemaSpec spec) {
    var llm = props.getLlm();
    if (!llm.isEnabled() || llm.getApiKey() == null || llm.getApiKey().isBlank()) {
      throw new LlmClientException("LLM is disabled or missing API key");
    }

    try {
      return generateWithResponses(prompt, spec);
    } catch (LlmClientException e) {
      if (e.status != 400 && e.status != 404 && e.status != 405) {
        throw e;
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

  private JsonNode postJson(String url, Map<String, Object> payload) {
    try {
      String body = mapper.writeValueAsString(payload);
      HttpRequest request = HttpRequest.newBuilder(URI.create(url))
          .timeout(Duration.ofMillis(props.getLlm().getTimeoutMs()))
          .header("Authorization", "Bearer " + props.getLlm().getApiKey())
          .header("Content-Type", "application/json")
          .header("Accept", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .build();
      HttpClient client = HttpClient.newBuilder()
          .connectTimeout(Duration.ofMillis(props.getLlm().getTimeoutMs()))
          .build();
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new LlmClientException("HTTP " + response.statusCode() + ": " + response.body(), response.statusCode());
      }
      return mapper.readTree(response.body());
    } catch (IOException e) {
      throw new LlmClientException(e.getMessage(), e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LlmClientException("LLM request interrupted", e);
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
