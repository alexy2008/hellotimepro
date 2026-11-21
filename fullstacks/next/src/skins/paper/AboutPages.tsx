// ============================================================
// 「时笺」关于（/about）与 404
// 结构与类名照 2.0 原型 paper/view-about.js；只展示本实现自己的前后端技术栈
// ============================================================

import { type CSSProperties } from "react";
import { Link } from "@/lib/router";
import { Icon } from "@/lib/icons";
import { FEATURES, TECH_NOTE, TENETS } from "@/lib/about";
import { FRONTEND_STACK, ROLE_LABEL, TechIcon, useHealth } from "@/components/shared";
import type { StackItem } from "@/types";
import { Seal } from "./parts";

export const FRONTEND_SUMMARY =
  "Next.js App Router 用文件系统路由组织页面与 /api/v1 接口，页面在客户端渲染、Zustand 做轻量状态管理；样式原样引入 spec/styles 的两套皮肤，换皮肤、换明暗只改 <html> 上的两个属性。";

function StackCard({ kind, title, sub, items, summary }: { kind: string; title: string; sub: string; items: StackItem[]; summary: string }) {
  return (
    <article className="spec">
      <header className="spec__head">
        <div>
          <div className="spec__k">{kind}</div>
          <h3 className="spec__t serif">{title}</h3>
        </div>
        <span className="spec__sub mono">{sub}</span>
      </header>
      <ul className="spec__list">
        {items.map((it) => (
          <li key={it.role + it.name} className="tech" data-testid="stack-item" data-name={it.name}>
            <TechIcon item={it} className="tech__ic" />
            <div className="tech__main">
              <b>
                {it.name}
                <small className="mono">{it.version}</small>
              </b>
              <span>{TECH_NOTE[it.name] ?? ""}</span>
            </div>
            <em className="tech__role">{ROLE_LABEL[it.role] ?? it.role}</em>
          </li>
        ))}
      </ul>
      <p className="spec__sum">{summary}</p>
    </article>
  );
}

export function PaperAboutPage() {
  const { health, online } = useHealth();
  const backend = health?.stack.items ?? [];
  const backendName = backend.find((i) => i.role === "framework")?.name ?? backend[0]?.name ?? "后端";
  return (
    <div className="page page--about">
      <div className="wrap about">
        <header className="about__hero">
          <div className="overline">
            <i />
            About
          </div>
          <h1 className="about__title">
            <span>有些话，</span>
            <span>
              要<em>等一等</em>再说<i className="about__stop" />
            </span>
          </h1>
          <div className="about__lede">
            <p>HelloTime Pro 是一款时间胶囊应用：写下一段话，设定未来某一刻才能开启，封存之后不可修改。它有胶囊广场、AI 代笔、收藏与账号。</p>
            <p>
              它同时也是一个<b>多技术栈对比学习项目</b>的一部分。你正在使用的这一套，由下面的前端与后端技术栈实现，并遵循项目统一的 API 契约、数据库 schema 与设计令牌。
            </p>
          </div>
        </header>

        <section className="about__sec">
          <header className="sechead">
            <span className="sechead__no">壹</span>
            <div>
              <h2 className="h2">此刻运行的技术栈</h2>
              <p>页脚与这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p>
            </div>
          </header>
          <div className="about__live">
            <span className={`dot${online ? " dot--on" : ""}`} />
            {online === false ? "后端离线" : "后端在线"}
            <i />
            <span className="mono">GET /api/v1/health</span>
          </div>
          <div className="about__stack" data-testid="about-stack">
            <StackCard kind="前端" title="Next.js" sub="fullstacks/next" items={FRONTEND_STACK} summary={FRONTEND_SUMMARY} />
            {health ? <StackCard kind="后端" title={backendName} sub={health.stack.kind === "fullstack" ? "fullstack" : "backend"} items={backend} summary={health.stack.summary} /> : null}
          </div>
        </section>

        <section className="about__sec">
          <header className="sechead">
            <span className="sechead__no">贰</span>
            <div>
              <h2 className="h2">它能做什么</h2>
              <p>一枚胶囊从写下到被读到，会经过的每一步。</p>
            </div>
          </header>
          <ol className="feats" data-testid="about-features">
            {FEATURES.map(([, t, d], i) => (
              <li key={t} style={{ "--i": i } as CSSProperties} data-testid="about-feature">
                <span className="feats__no latin">{String(i + 1).padStart(2, "0")}</span>
                <b className="serif">{t}</b>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="about__sec">
          <header className="sechead">
            <span className="sechead__no">叁</span>
            <div>
              <h2 className="h2">四条原则</h2>
              <p>这个仓库为什么长成现在的样子。</p>
            </div>
          </header>
          <ol className="tenets" data-testid="about-tenets">
            {TENETS.map(([t, d]) => (
              <li key={t} data-testid="about-tenet">
                <b className="serif">{t}</b>
                <p dangerouslySetInnerHTML={{ __html: d }} />
              </li>
            ))}
          </ol>
        </section>

        <section className="about__sec about__sec--end">
          <div className="credits">
            <div>
              <h3 className="serif">源码</h3>
              <p>
                全部实现都在同一个仓库里，按 <code className="mono">backends / frontends / fullstacks / desktop / mobile</code> 分目录；这一套在 <code className="mono">fullstacks/next</code>。
              </p>
            </div>
            <div>
              <h3 className="serif">致谢</h3>
              <p>技术栈图标来自 Simple Icons 与各项目官方标识；字体来自思源宋体、Cormorant Garamond 与 IBM Plex Mono；感谢每一个开源框架的作者与维护者。</p>
            </div>
            <div>
              <h3 className="serif">许可</h3>
              <p>MIT License。本项目用于教学、对比与研究，不面向生产环境。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function PaperNotFoundPage() {
  return (
    <div className="page">
      <div className="wrap wrap--narrow detail">
        <div className="lost" data-testid="not-found">
          <div className="lost__mark">
            <Seal ch="迷" variant="line" />
          </div>
          <h1 className="h1">查无此页</h1>
          <p>
            这个地址没有对应的页面。
            <br />
            也许是链接抄错了一位，也许它从未存在过。
          </p>
          <div className="lost__act">
            <Link className="btn btn--primary" to="/">
              回到广场
            </Link>
            <Link className="btn btn--ghost" to="/open">
              <Icon name="key" />
              凭码开启
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
