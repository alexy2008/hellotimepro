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
    boolean isSqlite = "sqlite".equals(props.getDbDriver());
    String dbName = isSqlite ? "SQLite" : "PostgreSQL";
    String dbIcon = isSqlite ? "sqlite" : "postgresql";
    String dbVer = isSqlite ? "3" : "16";

    String summary =
        "Java 21 + Spring Boot 3 的服务端渲染全栈：同一进程用 Spring MVC + Thymeleaf + HTMX 直出双皮肤 HTML、" +
        "httpOnly cookie 承载会话，并对外暴露完整的 /api/v1 JSON 契约（Bearer）。" +
        "持久层基于 Spring Data JPA 与 Hibernate，仓库级 scripts/db 维护数据库 schema，" +
        "自定义跨库 JdbcType 同时支持 PostgreSQL 与 SQLite 双数据库驱动切换。" +
        "针对并发一致性配置了 JPA 悲观行锁（PostgreSQL）与 IMMEDIATE 写事务（SQLite），" +
        "全局异常处理器按 @RestController 边界将业务与校验异常统一转换为契约响应外壳。";

    List<StackItem> items = List.of(
        new StackItem("language", "Java", String.valueOf(Runtime.version().feature()),
            "/static/icons/java.svg"),
        new StackItem("framework", "Spring Boot", SpringBootVersion.getVersion(),
            "/static/icons/springboot.svg"),
        new StackItem("orm", "Hibernate", "6.5",
            "/static/icons/hibernate.svg"),
        new StackItem("database", dbName, dbVer,
            "/static/icons/" + dbIcon + ".svg")
    );

    return new StackInfo("fullstack", summary, items);
  }

  public List<StackItem> frontendItems() {
    return List.of(
        new StackItem("framework", "Thymeleaf", "3.1", null),
        new StackItem("enhancement", "HTMX", "2.0", null),
        new StackItem("language", "JavaScript", "ES2023", "/static/icons/javascript.svg")
    );
  }

  public String frontendSummary() {
    return "基于 Spring MVC + Thymeleaf 服务端渲染，承载「时笺」与「琥珀」两套 2.0 皮肤及明暗主题。" +
        "首屏由服务端拼装完整 HTML 直出，内联脚本在绘制前读取 localStorage 设定皮肤与主题，杜绝首帧闪烁；" +
        "HTMX 以 HTML-over-the-wire 负责广场搜索、筛选、排序与分页的局部片段刷新；" +
        "渐进增强的原生 JavaScript 负责星轨时钟、对数时间标尺、8 格输码、AI 代笔打字机与 View Transition 皮肤转场，" +
        "样式原样引入 spec/styles 语义令牌。";
  }
}
