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

    String summary =
        "基于 Java + Spring Boot 3 + Spring Data JPA 核心骨架，" +
        "选用 Hibernate 作为 JPA 提供商，仓库级 scripts/db 维护数据库 schema，" +
        "Jackson 负责 JSON 序列化，Jakarta Bean Validation 实现声明式数据校验，" +
        "同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。" +
        "利用 Spring 核心的控制反转与依赖注入容器，以单例模式管理组件，" +
        "Spring Boot 自动配置开箱即用。" +
        "Spring Data JPA 通过方法名自动解析生成 SQL 查询，" +
        "针对跨库时间列差异自制了全局属性转换器，并配置了 JPA 级别悲观锁确保行级并发一致性。" +
        "通过在 DTO 记录类属性上贴附 Bean Validation 注解完成请求边界拦截，结合注解声明式路由映射。" +
        "基于 Spring AOP 机制使用 @Transactional 实现无侵入的声明式事务管理，" +
        "全局异常处理器将业务异常统一捕获并转换为契约约定的错误响应。";

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
