package com.hellotimepro.springmvc.service;

import com.hellotimepro.springmvc.config.AppProperties;
import com.hellotimepro.springmvc.dto.Dtos.StackInfo;
import com.hellotimepro.springmvc.dto.Dtos.StackItem;
import java.util.List;
import org.springframework.boot.SpringBootVersion;
import org.springframework.stereotype.Service;

@Service
public class HealthStackService {
  private final AppProperties props;

  public HealthStackService(AppProperties props) {
    this.props = props;
  }

  public StackInfo stack() {
    boolean isSqlite = props.getDbDriver().equals("sqlite");
    String dbName = isSqlite ? "SQLite" : "PostgreSQL";
    String dbIcon = isSqlite ? "sqlite" : "postgresql";
    String dbVer = isSqlite ? "3" : "16";

    String summary =
        "Java + Spring Boot 3 的服务端渲染全栈：同一进程用 Spring MVC + Thymeleaf + HTMX 直出 HTML、" +
        "httpOnly cookie 承载会话，并对外暴露同一套 /api/v1 JSON 契约（Bearer）。" +
        "持久层基于 Spring Data JPA，" +
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

    return new StackInfo("fullstack", summary, items);
  }
}
