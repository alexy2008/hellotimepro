package com.hellotimepro.springboot.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.dto.Dtos.Avatar;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.dto.Dtos.HealthData;
import com.hellotimepro.springboot.dto.Dtos.StackInfo;
import com.hellotimepro.springboot.dto.Dtos.StackItem;
import com.hellotimepro.springboot.service.AvatarService;
import jakarta.annotation.PostConstruct;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringBootVersion;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {
  private final AppProperties props;
  private final AvatarService avatars;
  private Map<String, Map<String, Object>> techMeta = Collections.emptyMap();

  public HealthController(AppProperties props, AvatarService avatars) {
    this.props = props;
    this.avatars = avatars;
  }

  @PostConstruct
  void loadTechMeta() {
    try {
      Path file = Path.of(props.getRepoRoot()).toAbsolutePath().normalize()
          .resolve("spec/tech-meta.json");
      if (Files.exists(file)) {
        techMeta = new ObjectMapper().readValue(file.toFile(),
            new TypeReference<>() {});
      }
    } catch (Exception ignored) {}
  }

  private String tagline(String name) {
    var entry = techMeta.get(name);
    return entry != null ? (String) entry.get("tagline") : null;
  }

  @SuppressWarnings("unchecked")
  private List<String> features(String name) {
    var entry = techMeta.get(name);
    return entry != null ? (List<String>) entry.get("features") : null;
  }

  private StackItem item(String role, String name, String version, String iconUrl) {
    return new StackItem(role, name, version, iconUrl, tagline(name), features(name));
  }

  @GetMapping("/health")
  public Envelope<HealthData> health() {
    String dbName = props.getDbDriver().equals("sqlite") ? "SQLite" : "PostgreSQL";
    String dbIcon = props.getDbDriver().equals("sqlite") ? "sqlite" : "postgresql";
    List<StackItem> items = List.of(
        item("language", "Java", Runtime.version().feature() + "", "/static/icons/java.svg"),
        item("framework", "Spring Boot", SpringBootVersion.getVersion(), "/static/icons/springboot.svg"),
        item("database", dbName, props.getDbDriver().equals("sqlite") ? "3" : "16", "/static/icons/" + dbIcon + ".svg")
    );
    long uptime = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
    HealthData data = new HealthData("ok", props.getServiceName(), props.getServiceVersion(),
        uptime, new StackInfo("backend", items));
    return Envelope.ok(data);
  }

  @GetMapping("/avatars")
  public Envelope<List<Avatar>> avatars() {
    return Envelope.ok(avatars.list());
  }
}
