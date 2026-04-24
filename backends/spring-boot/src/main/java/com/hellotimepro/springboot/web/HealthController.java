package com.hellotimepro.springboot.web;

import com.hellotimepro.springboot.config.AppProperties;
import com.hellotimepro.springboot.dto.Dtos.Avatar;
import com.hellotimepro.springboot.dto.Dtos.Envelope;
import com.hellotimepro.springboot.dto.Dtos.HealthData;
import com.hellotimepro.springboot.dto.Dtos.StackInfo;
import com.hellotimepro.springboot.dto.Dtos.StackItem;
import com.hellotimepro.springboot.service.AvatarService;
import java.lang.management.ManagementFactory;
import java.util.List;
import org.hibernate.Version;
import org.springframework.boot.SpringBootVersion;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {
  private final AppProperties props;
  private final AvatarService avatars;

  public HealthController(AppProperties props, AvatarService avatars) {
    this.props = props;
    this.avatars = avatars;
  }

  @GetMapping("/health")
  public Envelope<HealthData> health() {
    String dbName = props.getDbDriver().equals("sqlite") ? "SQLite" : "PostgreSQL";
    String dbIcon = props.getDbDriver().equals("sqlite") ? "sqlite" : "postgresql";
    List<StackItem> items = List.of(
        new StackItem("language", "Java", Runtime.version().feature() + "", "/static/icons/java.svg"),
        new StackItem("framework", "Spring Boot", SpringBootVersion.getVersion(), "/static/icons/springboot.svg"),
        new StackItem("database", dbName, props.getDbDriver().equals("sqlite") ? "3" : "16", "/static/icons/" + dbIcon + ".svg"),
        new StackItem("orm", "Hibernate", Version.getVersionString(), null)
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
