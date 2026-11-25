// ============================================================
// 关于页的共用文字：功能、原则、技术栈注释（与 spec/ui/copy.md §5 一致）
// 由 2.0 原型的 data.js 导出；两套皮肤只是排版不同
// ============================================================

import type { IconName } from "@/lib/icons";
import type { StackItem } from "@/types";

export const FEATURES: Array<[IconName, string, string]> = [
  ["user", "账号与头像", "邮箱注册即登录；十个内置头像，昵称全站唯一。"],
  ["pen", "写一枚胶囊", "标题、正文、开启时间；没有头绪时，AI 给灵感，也能代笔。"],
  ["hourglass", "倒计时与自动开启", "没到时间只显示倒计时；归零的那一刻，胶囊自己打开。"],
  ["globe", "胶囊广场", "公开的胶囊陈列在这里，可搜索、筛选，按最新或最热排序。"],
  ["heart", "收藏与「我的」", "收藏任何一枚胶囊，等它开启；在「我的」里管理写过的每一枚。"],
  ["sparkle", "两套皮肤，昼夜两色", "「时笺」与「琥珀」随时切换，各有明暗两套主题，并记住你的选择。"],
];

/** 原则的说明里可能含 <code>，按 HTML 渲染（内容是本文件的常量） */
export const TENETS: Array<[string, string]> = [
  ["规范即唯一事实源", "业务契约放在 <code class=\"mono\">spec/</code> 下：OpenAPI、数据库 schema、设计令牌。代码只是规范的投影，有歧义先改规范。"],
  ["栈内地道", "Signals、组合式、Hooks、Runes、Compose……每个实现都用自己技术栈的惯用写法，而不是把同一份代码翻译十遍。"],
  ["外部一致", "无论内部怎么写，对外的路由、JSON 形状、错误码与界面必须一致——肉眼可比，才谈得上对比。"],
  ["黑盒验证", "契约用例与 UI 冒烟都从外部跑，不信任任何实现的自述；每个后端都要在 PostgreSQL 与 SQLite 上各过一遍。"],
];

export const TECH_NOTE: Record<string, string> = {
  "Nuxt": "基于 Vue 的全栈框架，提供文件路由、服务端渲染和混合渲染",
  "Nitro": "Nuxt 的服务端引擎，提供 API 文件路由与 Node 部署产物",
  "Drizzle ORM": "用 TypeScript 表定义构建 SQL 查询，分别接入 PostgreSQL 与 SQLite",
  "Vue": "渐进式框架：模板 + 响应式系统，组合式 API 让逻辑按功能聚合",
  "TypeScript": "给 JavaScript 加上静态类型的工业级超集",
  "Python": "优雅、动态的通用语言，类型注解让大项目也安心",
  "FastAPI": "基于 Starlette + Pydantic 的现代异步框架",
  "PostgreSQL": "功能丰富的开源关系型数据库",
  "SQLite": "嵌入式单文件关系型数据库，零配置即可运行",
  "SQLAlchemy": "Python 生态里最严谨的关系映射库",
  "Java": "运行在 JVM 上的强类型语言，一次编写处处运行",
  "Spring Boot": "Java 生态最主流的企业级框架，约定优于配置",
  "Hibernate": "JPA 规范的事实参考实现",
  "Go": "简洁与并发是其核心的编译型语言",
  "Gin": "Go 生态最流行的高性能 HTTP 框架",
  "Bun": "把运行时、打包器、测试器合而为一的 JS 运行时",
  "Elysia": "为 Bun 量身打造的类型安全框架",
  "Node.js": "基于 V8 的服务端 JavaScript 运行时",
  "NestJS": "Angular 风格的 Node.js 企业级框架",
  "C#": ".NET 生态的核心，多范式静态语言",
  "ASP.NET Core": "微软跨平台高性能 Web 框架",
  ".NET": "跨平台的托管运行时与基础类库",
  "EF Core": ".NET 旗舰 ORM，LINQ 即查询",
  "Swift": "Apple 设计的现代安全语言",
  "Vapor": "Swift 原生 Web 框架，类型安全且性能出色",
  "SwiftNIO": "Swift 的事件驱动非阻塞网络框架",
  "Rust": "没有 GC 的系统级语言，所有权模型保证内存安全",
  "Axum": "基于 Tokio + Tower 的异步 Web 框架",
  "Tokio": "Rust 的异步运行时",
  "C++": "零开销抽象的系统级语言",
  "Drogon": "C++ 异步 HTTP 框架，性能极限选手",
  "Trantor": "Drogon 底层的非阻塞 I/O 网络库",
  "Kotlin": "JetBrains 打造的现代 JVM 语言",
  "Ktor": "JetBrains 出品的 Kotlin 异步框架",
  "JVM": "Java 虚拟机：JIT 编译 + 分代 GC",
  "Vite": "基于原生 ES 模块的前端构建工具，开发时几乎零等待",
  "Pinia": "Vue 官方状态管理：setup 风格的 store，类型推导开箱即用"
};

// ---------------------------------------------------------------- 本前端的技术栈


/** 技术栈角色的中文名（页脚与关于页） */
export const ROLE_LABEL: Record<string, string> = {
  language: "语言",
  framework: "框架",
  database: "数据库",
  orm: "ORM",
  runtime: "运行时",
  styling: "样式",
  build: "构建",
  state: "状态管理",
};

/** 本前端自己的技术栈（页脚与关于页用）；后端那一半来自 /health */
export const FRONTEND_STACK: StackItem[] = [
  { role: "framework", name: "Nuxt", version: "3", iconUrl: "/static/icons/nuxt.svg" },
  { role: "framework", name: "Vue", version: "3.5", iconUrl: "/static/icons/vue.svg" },
  { role: "state", name: "Pinia", version: "3" },
];

export const FRONTEND_SUMMARY =
  "基于 Nuxt 3 文件系统路由与 Vue 3.5 组合式 API 构建界面层，公用布局统一承载「时笺」与「琥珀」两套 2.0 皮肤及昼夜主题。" +
  "广场与胶囊详情借助 useAsyncData 在服务端取数直出首屏，浏览器端直接复用脱水载荷避免二次请求；登录态在客户端恢复并配合路由守卫处理回跳。" +
  "Pinia 3 以 setup 风格管理全局状态，表单、草稿与筛选条件跨皮肤保留；样式原样引入 spec/styles 语义令牌，首帧前注入脚本防止闪烁。";
