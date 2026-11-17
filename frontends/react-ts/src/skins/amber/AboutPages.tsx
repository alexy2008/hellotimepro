// ============================================================
// 「琥珀」关于（/about）与 404
// 结构与类名照 2.0 原型 amber/view-about.js；只展示本实现自己的前后端技术栈
// ============================================================

import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/lib/icons";
import { FEATURES, TECH_NOTE, TENETS } from "@/lib/about";
import { FRONTEND_STACK, ROLE_LABEL, TechIcon, useHealth } from "@/components/shared";
import { FRONTEND_SUMMARY } from "@/skins/paper/AboutPages";
import type { StackItem } from "@/types";
import { AmberLogo } from "./Shell";
import { CapsuleArt } from "./parts";

function StackCard({ kind, en, path, items, summary }: { kind: string; en: string; path: string; items: StackItem[]; summary: string }) {
  return (
    <article className="card card--pad stack-card">
      <div className="eyebrow">{en}</div>
      <h2 className="card__title">
        {kind}
        <small className="mono">{path}</small>
      </h2>
      <p className="card__lead">{summary}</p>
      <ul className="stack-list">
        {items.map((it) => (
          <li key={it.role + it.name} data-testid="stack-item" data-name={it.name}>
            <span className="stack-list__ic">
              <TechIcon item={it} className="tech-ic" />
            </span>
            <div>
              <b>
                {it.name}
                <small className="mono">{it.version}</small>
              </b>
              <span>{TECH_NOTE[it.name] ?? ""}</span>
            </div>
            <em>{ROLE_LABEL[it.role] ?? it.role}</em>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function AmberAboutPage() {
  const { health, online } = useHealth();
  const backend = health?.stack.items ?? [];
  const backendName = backend.find((i) => i.role === "framework")?.name ?? backend[0]?.name ?? "后端";
  return (
    <div className="page page--about">
      <div className="container about">
        <header className="about__hero">
          <div className="about__badge">
            <span className="about__ring" />
            <AmberLogo size={112} />
          </div>
          <div>
            <div className="eyebrow">About</div>
            <h1 className="about__title">
              HelloTime Pro <span className="pill mono">v2.0</span>
            </h1>
            <p className="about__motto">有些话，要等一等再说。</p>
            <p className="page-lead">一款时间胶囊应用：写下一段话，设定一个未来的时刻，封存之后谁也打不开，直到那一刻到来。你可以把它发布到广场，也可以只把胶囊码交给一个人。</p>
          </div>
        </header>

        <section className="about__sec">
          <div className="eyebrow">Tech stack</div>
          <h2 className="section-title">此刻运行的技术栈</h2>
          <p className="page-lead">页脚和这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p>
          <div className="about__live">
            <span className="ftr__dot" />
            {online === false ? "后端离线" : "后端在线"} · <span className="mono">GET /api/v1/health</span>
          </div>
          <div className="about__stacks" data-testid="about-stack">
            <StackCard kind="前端" en="Frontend" path="frontends/react-ts" items={FRONTEND_STACK} summary={FRONTEND_SUMMARY} />
            {health ? <StackCard kind={`后端 · ${backendName}`} en="Backend" path={health.stack.kind} items={backend} summary={health.stack.summary} /> : null}
          </div>
        </section>

        <section className="about__sec">
          <div className="eyebrow">Features</div>
          <h2 className="section-title">它能做什么</h2>
          <div className="features" data-testid="about-features">
            {FEATURES.map(([ic, t, d], i) => (
              <article key={t} className="feature card" style={{ "--i": i } as CSSProperties} data-testid="about-feature">
                <span className="feature__ic">
                  <Icon name={ic} />
                </span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about__sec card card--pad dnotes">
          <div className="eyebrow">Principles</div>
          <h2 className="section-title">四条原则</h2>
          <p className="card__lead">这个仓库为什么长成现在的样子。</p>
          <div className="dnotes__grid dnotes__grid--4" data-testid="about-tenets">
            {TENETS.map(([t, d]) => (
              <div key={t} data-testid="about-tenet">
                <h3>{t}</h3>
                <p dangerouslySetInnerHTML={{ __html: d }} />
              </div>
            ))}
          </div>
        </section>

        <section className="about__sec about__credits">
          <div>
            <h3>
              <Icon name="code" />
              源码
            </h3>
            <p>
              实现位于仓库的 <code className="mono">frontends/react-ts</code> 与 <code className="mono">backends/</code> 目录。
            </p>
          </div>
          <div>
            <h3>
              <Icon name="heart" />
              致谢
            </h3>
            <p>技术栈图标来自 Simple Icons 与各项目官方标识；感谢每一个开源框架的作者与维护者。</p>
          </div>
          <div>
            <h3>
              <Icon name="book" />
              许可
            </h3>
            <p>MIT License。本项目用于教学与研究，不面向生产环境。</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export function AmberNotFoundPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="notice card" data-testid="not-found">
          <div className="notice__float">
            <CapsuleArt code="NOWHERE0" state="opened" width={220} />
          </div>
          <div className="eyebrow eyebrow--center">404</div>
          <h1 className="page-title">这一页飘走了</h1>
          <p className="page-lead">这个地址没有对应的页面。也许是链接抄错了一位，也许它从未存在过。</p>
          <div className="notice__act">
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
