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
        "基于 Java 21 与 Spring Boot 3 实现同源服务端，在同一进程内通过 Spring MVC 承载网页路由与完整的 /api/v1/* JSON 契约，" +
        "以 HttpOnly Cookie 维护网页会话、Bearer JWT 与 Refresh Token 家族轮换服务 API 请求。" +
        "持久层基于 Spring Data JPA 与 Hibernate 6.5，借助自定义跨库 JdbcType 同时支持 PostgreSQL 与 SQLite，" +
        "并分别配置悲观行锁与 IMMEDIATE 写事务保证并发一致，全局异常处理器按契约统一封装响应外壳。";

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
        new StackItem("template", "Thymeleaf", "3.1", null),
        new StackItem("enhancement", "HTMX", "2.0", null),
        new StackItem("language", "JavaScript", "ES2023", "/static/icons/javascript.svg")
    );
  }

  public String frontendSummary() {
    return "基于 Spring MVC 与 Thymeleaf 3.1 服务端模板构建界面层，同一视图承载「时笺」与「琥珀」两套 2.0 皮肤及明暗主题。" +
        "首屏由服务端拼装完整 HTML 直出，内联脚本在绘制前读取本地偏好写入皮肤与主题属性以杜绝闪烁；" +
        "HTMX 2.0 以超媒体方式驱动广场搜索、筛选、排序与分页的局部片段刷新。" +
        "渐进增强的原生 JavaScript 负责星轨时钟、对数时间标尺、8 格输码、AI 代笔打字机与 View Transition 转场，样式原样引入 spec/styles 语义令牌。";
  }
}
