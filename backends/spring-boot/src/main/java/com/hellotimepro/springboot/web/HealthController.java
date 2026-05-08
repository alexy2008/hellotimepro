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

    String dbTagline = isSqlite
        ? "零配置嵌入式关系型数据库，适合本地开发与测试"
        : "功能丰富的开源关系型数据库，号称「最先进的开源数据库」";
    List<String> dbFeatures = isSqlite
        ? List.of(
            "DB_DRIVER=sqlite 一键切换，无需部署独立数据库服务",
            "JPA 抽象层使同一领域代码在 SQLite / PostgreSQL 间无缝切换",
            "适合本地开发与 CI 验证场景")
        : List.of(
            "ACID 事务保障 favorite_count 反规范化计数的写入一致性",
            "refresh_tokens 表以 family_id + revoked 实现令牌族追踪，防重放攻击",
            "DB_DRIVER 环境变量热切换 SQLite/PostgreSQL，无需修改业务代码");

    String summary = isSqlite
        ? "基于 Java + Spring Boot 构建，Spring MVC 处理路由，JPA 抽象层屏蔽 SQLite / PostgreSQL 差异，Spring Security 提供 JWT 鉴权，适合本地开发与 CI 验证。"
        : "基于 Java + Spring Boot 构建，Spring MVC 处理路由，JPA + PostgreSQL 承载业务数据，Flyway 管理迁移，Spring Security 提供 JWT 双令牌鉴权，令牌族追踪防重放攻击。";

    List<StackItem> items = List.of(
        new StackItem("language", "Java", String.valueOf(Runtime.version().feature()),
            "/static/icons/java.svg",
            "静态强类型 JVM 语言，生态成熟、工具链完善",
            List.of(
                "静态类型 + 泛型系统，编译期消灭大量运行时错误",
                "JVM 平台成熟的并发模型，Virtual Threads（JDK 21+）降低阻塞开销",
                "Record 类型简化不可变 DTO，减少样板代码")),
        new StackItem("framework", "Spring Boot", SpringBootVersion.getVersion(),
            "/static/icons/springboot.svg",
            "Java 生态最主流的企业级 Web 框架，约定优于配置",
            List.of(
                "自动配置 + Starter 依赖，最小化手动配置",
                "@RestController + @RequestMapping 声明式路由，Spring Security 过滤链鉴权",
                "JPA + Flyway 数据层：实体映射 + 版本化迁移管理")),
        new StackItem("database", dbName, dbVer,
            "/static/icons/" + dbIcon + ".svg",
            dbTagline, dbFeatures)
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
