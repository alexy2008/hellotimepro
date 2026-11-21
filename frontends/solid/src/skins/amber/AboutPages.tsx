// ============================================================
// 「琥珀」关于（/about）与 404
// 结构与类名照 2.0 原型 amber/view-about.js；只展示本实现自己的前后端技术栈
// ============================================================

import { For, Show } from "solid-js";
import { Icon } from "@/lib/icons";
import { FEATURES, FRONTEND_STACK, FRONTEND_SUMMARY, ROLE_LABEL, TECH_NOTE, TENETS } from "@/lib/about";
import { TechIcon, createHealth } from "@/components/shared";
import type { StackItem } from "@/types";
import { AmberLogo } from "./Shell";
import { CapsuleArt } from "./parts";

function StackCard(props: { kind: string; en: string; path: string; items: StackItem[]; summary: string }) {
  return (
    <article class="card card--pad stack-card">
      <div class="eyebrow">{props.en}</div>
      <h2 class="card__title">
        {props.kind}
        <small class="mono">{props.path}</small>
      </h2>
      <p class="card__lead">{props.summary}</p>
      <ul class="stack-list">
        <For each={props.items}>
          {(it) => (
            <li data-testid="stack-item" data-name={it.name}>
              <span class="stack-list__ic">
                <TechIcon item={it} class="tech-ic" />
              </span>
              <div>
                <b>
                  {it.name}
                  <small class="mono">{it.version}</small>
                </b>
                <span>{TECH_NOTE[it.name] ?? ""}</span>
              </div>
              <em>{ROLE_LABEL[it.role] ?? it.role}</em>
            </li>
          )}
        </For>
      </ul>
    </article>
  );
}

export function AmberAboutPage() {
  const h = createHealth();
  return (
    <div class="page page--about">
      <div class="container about">
        <header class="about__hero">
          <div class="about__badge">
            <span class="about__ring" />
            <AmberLogo size={112} />
          </div>
          <div>
            <div class="eyebrow">About</div>
            <h1 class="about__title">
              HelloTime Pro <span class="pill mono">v2.0</span>
            </h1>
            <p class="about__motto">有些话，要等一等再说。</p>
            <p class="page-lead">一款时间胶囊应用：写下一段话，设定一个未来的时刻，封存之后谁也打不开，直到那一刻到来。你可以把它发布到广场，也可以只把胶囊码交给一个人。</p>
          </div>
        </header>

        <section class="about__sec">
          <div class="eyebrow">Tech stack</div>
          <h2 class="section-title">此刻运行的技术栈</h2>
          <p class="page-lead">页脚和这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p>
          <div class="about__live">
            <span class="ftr__dot" />
            {h.online() === false ? "后端离线" : "后端在线"} · <span class="mono">GET /api/v1/health</span>
          </div>
          <div class="about__stacks" data-testid="about-stack">
            <StackCard kind="前端" en="Frontend" path="frontends/solid" items={FRONTEND_STACK} summary={FRONTEND_SUMMARY} />
            <Show when={h.health()}>
              {(health) => (
                <StackCard kind={`后端 · ${h.backendName() ?? "后端"}`} en="Backend" path={health().stack.kind} items={h.backend()} summary={health().stack.summary} />
              )}
            </Show>
          </div>
        </section>

        <section class="about__sec">
          <div class="eyebrow">Features</div>
          <h2 class="section-title">它能做什么</h2>
          <div class="features" data-testid="about-features">
            <For each={FEATURES}>
              {([ic, t, d], i) => (
                <article class="feature card" style={{ "--i": i() }} data-testid="about-feature">
                  <span class="feature__ic">
                    <Icon name={ic} />
                  </span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              )}
            </For>
          </div>
        </section>

        <section class="about__sec card card--pad dnotes">
          <div class="eyebrow">Principles</div>
          <h2 class="section-title">四条原则</h2>
          <p class="card__lead">这个仓库为什么长成现在的样子。</p>
          <div class="dnotes__grid dnotes__grid--4" data-testid="about-tenets">
            <For each={TENETS}>
              {([t, d]) => (
                <div data-testid="about-tenet">
                  <h3>{t}</h3>
                  {/* 说明里可能含 <code>，内容是 lib/about.ts 的常量 */}
                  <p innerHTML={d} />
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="about__sec about__credits">
          <div>
            <h3>
              <Icon name="code" />
              源码
            </h3>
            <p>
              实现位于仓库的 <code class="mono">frontends/solid</code> 与 <code class="mono">backends/</code> 目录。
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
    <div class="page">
      <div class="container">
        <div class="notice card" data-testid="not-found">
          <div class="notice__float">
            <CapsuleArt code="NOWHERE0" state="opened" width={220} />
          </div>
          <div class="eyebrow eyebrow--center">404</div>
          <h1 class="page-title">这一页飘走了</h1>
          <p class="page-lead">这个地址没有对应的页面。也许是链接抄错了一位，也许它从未存在过。</p>
          <div class="notice__act">
            <a class="btn btn--primary" href="/">
              回到广场
            </a>
            <a class="btn btn--ghost" href="/open">
              <Icon name="key" />
              凭码开启
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
