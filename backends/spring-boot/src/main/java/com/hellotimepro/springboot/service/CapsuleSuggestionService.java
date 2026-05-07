package com.hellotimepro.springboot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.dto.Dtos.CapsuleSuggestion;
import com.hellotimepro.springboot.dto.Dtos.CapsuleSuggestionRequest;
import com.hellotimepro.springboot.service.LlmClientService.LlmClientException;
import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class CapsuleSuggestionService {
  private static final Logger log = LoggerFactory.getLogger(CapsuleSuggestionService.class);
  private static final List<Integer> FALLBACK_DAYS = List.of(30, 90, 180, 365);
  private static final String DEFAULT_PROMPT_TEMPLATE = ""
      + "你是中文写作助手。基于标题 {TITLE} 为用户生成一段 260~400 字的时光胶囊正文（content），"
      + "并给出建议的开启天数（openInDays，1~3650 整数）。"
      + "只返回严格 JSON：{\"content\":\"...\",\"openInDays\":30}。";

  private final AppProperties props;
  private final LlmClientService llm;
  private String promptTemplate = "";

  public CapsuleSuggestionService(AppProperties props, LlmClientService llm) {
    this.props = props;
    this.llm = llm;
  }

  @PostConstruct
  void loadPromptTemplate() {
    Path root = Path.of(props.getRepoRoot()).toAbsolutePath().normalize();
    Path prompt = root.resolve("spec/llm/capsule-suggestion.prompt.md");
    try {
      if (Files.exists(prompt)) {
        promptTemplate = Files.readString(prompt);
      }
    } catch (Exception e) {
      log.warn("Failed to load capsule-suggestion prompt: {}", e.getMessage());
    }
  }

  public CapsuleSuggestion suggest(CapsuleSuggestionRequest req) {
    String title = req.title().strip();
    String generatedBy = "local-template";
    String content;
    int days;

    try {
      JsonNode node = llm.generateCapsuleSuggestion(buildPrompt(title));
      String rawContent = node.path("content").asText("").strip();
      if (rawContent.length() > 5000) {
        rawContent = rawContent.substring(0, 5000);
      }
      int rawDays = coerceOpenInDays(node);
      if (rawContent.isBlank()) {
        throw new IllegalArgumentException("LLM returned empty content");
      }
      content = rawContent;
      days = rawDays;
      generatedBy = props.getLlm().getProvider() + ":" + props.getLlm().getModel();
    } catch (IllegalArgumentException | LlmClientException e) {
      log.warn("Capsule suggestion LLM failed; using local fallback: {}", e.getMessage());
      Object[] fb = fallback(title);
      content = (String) fb[0];
      days = (int) fb[1];
    }

    OffsetDateTime openAt = OffsetDateTime.now(ZoneOffset.UTC).plusDays(days);
    return new CapsuleSuggestion(content, days, openAt, generatedBy, false);
  }

  private String buildPrompt(String title) {
    String template = promptTemplate.isBlank() ? DEFAULT_PROMPT_TEMPLATE : promptTemplate;
    return template.replace("{TITLE}", title);
  }

  private int coerceOpenInDays(JsonNode node) {
    JsonNode v = node.get("openInDays");
    int days;
    if (v == null || v.isNull()) {
      throw new IllegalArgumentException("openInDays missing");
    }
    if (v.isIntegralNumber()) {
      days = v.intValue();
    } else if (v.isFloatingPointNumber()) {
      days = (int) v.doubleValue();
    } else if (v.isTextual()) {
      try {
        days = Integer.parseInt(v.asText().strip());
      } catch (NumberFormatException e) {
        throw new IllegalArgumentException("openInDays not a number");
      }
    } else {
      throw new IllegalArgumentException("openInDays not a number");
    }
    if (days < 1) {
      days = 1;
    }
    if (days > 3650) {
      days = 3650;
    }
    return days;
  }

  private Object[] fallback(String title) {
    int days = FALLBACK_DAYS.get(ThreadLocalRandom.current().nextInt(FALLBACK_DAYS.size()));
    String content = ""
        + "写下《" + title + "》这个标题的此刻，我希望未来的自己读到这段话时，能想起今天是怎样的心情。"
        + "如果一切都顺利，那就笑一笑；如果有什么没有按预期发生，也不必懊恼——你只是又长大了一些。\n\n"
        + "我不知道你现在在做什么，是不是还记得当下的那个细节：早晨的光线、桌上一杯还没喝完的水、"
        + "正在听的那首歌、一句还没说出口的话。把这些寄给你，是因为它们值得被记住。\n\n"
        + "记得照顾好自己，也记得对身边的人温柔一点。我们下次再见。";
    return new Object[]{content, days};
  }
}
