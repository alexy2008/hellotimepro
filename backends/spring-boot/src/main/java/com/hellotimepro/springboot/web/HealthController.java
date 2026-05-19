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
    boolean isSqlite = props.getDbDriver().equals("sqlite");
    String dbName = isSqlite ? "SQLite" : "PostgreSQL";
    String dbIcon = isSqlite ? "sqlite" : "postgresql";
    String dbVer  = isSqlite ? "3" : "16";

    String summary = isSqlite
        ? "基于 Java + Spring Boot 构建，Spring MVC 处理路由，JPA 抽象层屏蔽 SQLite / PostgreSQL 差异，Spring Security 提供 JWT 鉴权，适合本地开发与 CI 验证。"
        : "基于 Java + Spring Boot 构建，Spring MVC 处理路由，JPA + PostgreSQL 承载业务数据，Flyway 管理迁移，Spring Security 提供 JWT 双令牌鉴权，令牌族追踪防重放攻击。";

    List<StackItem> items = List.of(
        new StackItem("language", "Java", String.valueOf(Runtime.version().feature()),
            "/static/icons/java.svg"),
        new StackItem("framework", "Spring Boot", SpringBootVersion.getVersion(),
            "/static/icons/springboot.svg"),
        new StackItem("database", dbName, dbVer,
            "/static/icons/" + dbIcon + ".svg")
    );

    long uptime = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
    HealthData data = new HealthData("ok", props.getServiceName(), props.getServiceVersion(),
        uptime, new StackInfo("backend", summary, items));
    return Envelope.ok(data);
  }

  @GetMapping("/avatars")
  public Envelope<List<Avatar>> avatars() {
    return Envelope.ok(avatars.list());
  }
}
