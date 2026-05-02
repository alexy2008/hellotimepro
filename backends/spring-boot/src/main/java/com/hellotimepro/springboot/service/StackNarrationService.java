package com.hellotimepro.springboot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.dto.Dtos.StackItem;
import com.hellotimepro.springboot.dto.Dtos.StackNarration;
import com.hellotimepro.springboot.dto.Dtos.StackNarrationRequest;
import com.hellotimepro.springboot.service.LlmClientService.LlmClientException;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class StackNarrationService {
  private static final Logger log = LoggerFactory.getLogger(StackNarrationService.class);
  private static final String PROMPT_VERSION = "stack-narration-v2";

  private final AppProperties props;
  private final ObjectMapper mapper;
  private final LlmClientService llm;
  private final Map<String, StackNarration> cache = new ConcurrentHashMap<>();
  private Map<String, Map<String, Object>> techMeta = Map.of();
  private String promptTemplate = "";

  public StackNarrationService(AppProperties props, ObjectMapper mapper, LlmClientService llm) {
    this.props = props;
    this.mapper = mapper;
    this.llm = llm;
  }

  @PostConstruct
  void loadSpecFiles() {
    Path root = repoRoot();
    try {
      Path prompt = root.resolve("spec/llm/stack-narration.prompt.md");
      if (Files.exists(prompt)) {
        promptTemplate = Files.readString(prompt);
      }
    } catch (Exception e) {
      log.warn("Failed to load stack narration prompt: {}", e.getMessage());
    }

    try {
      Path meta = root.resolve("spec/tech-meta.json");
      if (Files.exists(meta)) {
        techMeta = mapper.readValue(meta.toFile(), new TypeReference<>() {});
      }
    } catch (Exception e) {
      log.warn("Failed to load tech metadata: {}", e.getMessage());
    }
  }

  public StackNarration narrate(StackNarrationRequest req) {
    String key = cacheKey(req);
    StackNarration cached = cache.get(key);
    if (cached != null) {
      return new StackNarration(cached.title(), cached.narrative(), cached.generatedBy(), true);
    }

    StackNarration result;
    try {
      Map<String, String> generated = llm.generateStructuredNarration(buildPrompt(req));
      result = new StackNarration(
          generated.getOrDefault("title", "").strip(),
          generated.getOrDefault("narrative", "").strip(),
          props.getLlm().getProvider() + ":" + props.getLlm().getModel(),
          false
      );
      if (result.title().isBlank() || result.narrative().isBlank()) {
        throw new IllegalArgumentException("LLM result was empty");
      }
    } catch (IllegalArgumentException | LlmClientException e) {
      log.warn("Stack narration LLM failed; using local fallback: {}", e.getMessage());
      result = fallback(req);
    }

    cache.put(key, result);
    return result;
  }

  private Path repoRoot() {
    return Path.of(props.getRepoRoot()).toAbsolutePath().normalize();
  }

  private String buildPrompt(StackNarrationRequest req) {
    String template = promptTemplate.isBlank()
        ? "你是一个资深全栈工程教育作者。请基于 STACK_JSON 和 TECH_META_JSON 生成严格 JSON：{\"title\":\"...\",\"narrative\":\"...\"}。"
        : promptTemplate;
    return template
        .replace("{STACK_JSON}", toJson(requestPayload(req)))
        .replace("{TECH_META_JSON}", toJson(selectedMeta(req)));
  }

  private Map<String, Object> requestPayload(StackNarrationRequest req) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("frontend", req.frontend());
    payload.put("backend", req.backend());
    payload.put("locale", req.locale() == null || req.locale().isBlank() ? "zh-CN" : req.locale());
    return payload;
  }

  private Map<String, Object> selectedMeta(StackNarrationRequest req) {
    List<String> names = new ArrayList<>();
    req.frontend().items().forEach(item -> names.add(item.name()));
    req.backend().items().forEach(item -> names.add(item.name()));

    Map<String, Object> selected = new LinkedHashMap<>();
    names.stream().distinct().sorted(Comparator.naturalOrder()).forEach(name -> {
      Map<String, Object> entry = techMeta.get(name);
      if (entry == null) {
        return;
      }
      Map<String, Object> compact = new LinkedHashMap<>();
      compact.put("tagline", entry.get("tagline"));
      compact.put("features", entry.get("features"));
      selected.put(name, compact);
    });
    return selected;
  }

  private String cacheKey(StackNarrationRequest req) {
    String raw = toJson(Map.of(
        "request", requestPayload(req),
        "model", props.getLlm().getModel(),
        "promptVersion", PROMPT_VERSION
    ));
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      return raw;
    }
  }

  private String toJson(Object value) {
    try {
      return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("Failed to encode prompt payload", e);
    }
  }

  private StackNarration fallback(StackNarrationRequest req) {
    String frontend = mainItem("framework", req.frontend().items());
    String frontendLang = mainItem("language", req.frontend().items());
    String styling = mainItem("styling", req.frontend().items());
    String backend = mainItem("framework", req.backend().items());
    String backendLang = mainItem("language", req.backend().items());
    String database = mainItem("database", req.backend().items());
    String title = frontend + " + " + backend + " + " + database;
    String narrative = frontend + "、" + frontendLang + " 和 " + styling
        + " 让胶囊创建、广场筛选这类交互保持组件化、类型可追踪和令牌化样式约束；"
        + backend + " 与 " + backendLang
        + " 则把请求校验、OpenAPI 合同和运行时约束显式放在接口边界上，再交给 "
        + database + " 的事务模型承载刷新令牌、收藏计数和解锁时间等一致性要求。"
        + "这组栈的教学重点不是各技术单点能力，而是观察 UI 状态、接口契约、迁移和数据约束如何互相校准；"
        + "收益是边界清晰、替换后端容易，成本是类型、错误处理和数据演进都需要持续维护。";
    return new StackNarration(title, narrative, "local-template", false);
  }

  private String mainItem(String role, List<StackItem> items) {
    return items.stream()
        .filter(item -> role.equals(item.role()))
        .map(StackItem::name)
        .findFirst()
        .orElse(items.isEmpty() ? "未知" : items.get(0).name());
  }
}
