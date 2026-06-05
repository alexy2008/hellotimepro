package com.hellotimepro.springmvc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hellotimepro.springmvc.config.AppProperties;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleRecommendationItem;
import com.hellotimepro.springmvc.dto.Dtos.CapsuleRecommendationList;
import com.hellotimepro.springmvc.service.LlmClientService.LlmClientException;
import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** 为创建页提供 AI 推荐主题；推荐为锦上添花：LLM 不可用时返回空列表，不本地兜底、不报错。 */
@Service
public class CapsuleRecommendationService {
  private static final Logger log = LoggerFactory.getLogger(CapsuleRecommendationService.class);
  private static final int MIN_ITEMS = 3;
  private static final int MAX_ITEMS = 8;
  private static final String DEFAULT_PROMPT_TEMPLATE = ""
      + "你是中文写作助手。请生成 {COUNT} 条互不重复的时光胶囊主题推荐，时间跨度兼顾近远。"
      + "每条含 title（1~24 字中文标题）、hint（一句话灵感）、openInDays（1~3650 整数）。"
      + "只返回严格 JSON：{\"items\":[{\"title\":\"...\",\"hint\":\"...\",\"openInDays\":30}]}。";

  private final AppProperties props;
  private final LlmClientService llm;
  private String promptTemplate = "";

  public CapsuleRecommendationService(AppProperties props, LlmClientService llm) {
    this.props = props;
    this.llm = llm;
  }

  @PostConstruct
  void loadPromptTemplate() {
    Path root = Path.of(props.getRepoRoot()).toAbsolutePath().normalize();
    Path prompt = root.resolve("spec/llm/capsule-recommendation.prompt.md");
    try {
      if (Files.exists(prompt)) {
        promptTemplate = Files.readString(prompt);
      }
    } catch (Exception e) {
      log.warn("Failed to load capsule-recommendation prompt: {}", e.getMessage());
    }
  }

  public CapsuleRecommendationList getRecommendations(int count, String locale) {
    int n = Math.max(MIN_ITEMS, Math.min(MAX_ITEMS, count));
    List<CapsuleRecommendationItem> items = new ArrayList<>();
    try {
      JsonNode node = llm.generateCapsuleRecommendations(buildPrompt(n));
      items = parseItems(node.path("items"), n);
    } catch (RuntimeException e) {
      if (e instanceof LlmClientException || e instanceof IllegalArgumentException) {
        log.info("Capsule recommendations unavailable; returning empty list: {}", e.getMessage());
      } else {
        throw e;
      }
    }

    String generatedBy = items.isEmpty()
        ? "none"
        : props.getLlm().getProvider() + ":" + props.getLlm().getModel();
    return new CapsuleRecommendationList(items, generatedBy, false);
  }

  private String buildPrompt(int count) {
    String template = promptTemplate.isBlank() ? DEFAULT_PROMPT_TEMPLATE : promptTemplate;
    return template.replace("{COUNT}", String.valueOf(count));
  }

  private List<CapsuleRecommendationItem> parseItems(JsonNode raw, int limit) {
    List<CapsuleRecommendationItem> items = new ArrayList<>();
    if (raw == null || !raw.isArray()) {
      return items;
    }
    Set<String> seen = new LinkedHashSet<>();
    for (JsonNode entry : raw) {
      if (!entry.isObject()) {
        continue;
      }
      String title = clean(entry.path("title").asText(""), 60);
      String hint = clean(entry.path("hint").asText(""), 80);
      Integer days = clampDays(entry.get("openInDays"));
      if (title.isBlank() || hint.isBlank() || days == null || seen.contains(title)) {
        continue;
      }
      seen.add(title);
      items.add(new CapsuleRecommendationItem(title, hint, days));
      if (items.size() >= limit) {
        break;
      }
    }
    return items;
  }

  private String clean(String raw, int limit) {
    String cleaned = raw == null ? "" : raw.strip().replaceAll("[\\r\\n]+", " ");
    cleaned = cleaned.replaceAll("^[#*`　 \"'《》【】]+", "").replaceAll("[#*`　 \"'《》【】]+$", "").strip();
    if (cleaned.length() > limit) {
      cleaned = cleaned.substring(0, limit);
    }
    return cleaned;
  }

  private Integer clampDays(JsonNode v) {
    if (v == null || v.isNull()) {
      return null;
    }
    int days;
    if (v.isIntegralNumber()) {
      days = v.intValue();
    } else if (v.isFloatingPointNumber()) {
      days = (int) v.doubleValue();
    } else if (v.isTextual()) {
      try {
        days = Integer.parseInt(v.asText().strip());
      } catch (NumberFormatException e) {
        return null;
      }
    } else {
      return null;
    }
    return Math.max(1, Math.min(3650, days));
  }
}
