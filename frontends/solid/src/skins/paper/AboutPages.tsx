// ============================================================
// 「时笺」关于（/about）与 404
// 结构与类名照 2.0 原型 paper/view-about.js；只展示本实现自己的前后端技术栈
// ============================================================

import { For, Show } from "solid-js";
import { Icon } from "@/lib/icons";
import { FEATURES, FRONTEND_STACK, FRONTEND_SUMMARY, ROLE_LABEL, TECH_NOTE, TENETS } from "@/lib/about";
import { TechIcon, createHealth } from "@/components/shared";
import type { StackItem } from "@/types";
import { Seal } from "./parts";

function StackCard(props: { kind: string; title: string; sub: string; items: StackItem[]; summary: string }) {
  return (
    <article class="spec">
      <header class="spec__head">
        <div>
          <div class="spec__k">{props.kind}</div>
          <h3 class="spec__t serif">{props.title}</h3>
        </div>
        <span class="spec__sub mono">{props.sub}</span>
      </header>
      <ul class="spec__list">
        <For each={props.items}>
          {(it) => (
            <li class="tech" data-testid="stack-item" data-name={it.name}>
              <TechIcon item={it} class="tech__ic" />
              <div class="tech__main">
                <b>
                  {it.name}
                  <small class="mono">{it.version}</small>
                </b>
                <span>{TECH_NOTE[it.name] ?? ""}</span>
              </div>
              <em class="tech__role">{ROLE_LABEL[it.role] ?? it.role}</em>
            </li>
          )}
        </For>
      </ul>
      <p class="spec__sum">{props.summary}</p>
    </article>
  );
}

export function PaperAboutPage() {
  const h = createHealth();
  return (
    <div class="page page--about">
      <div class="wrap about">
        <header class="about__hero">
          <div class="overline">
            <i />
            About
          </div>
          <h1 class="about__title">
            <span>有些话，</span>
            <span>
              要<em>等一等</em>再说<i class="about__stop" />
            </span>
          </h1>
          <div class="about__lede">
            <p>HelloTime Pro 是一款时间胶囊应用：写下一段话，设定未来某一刻才能开启，封存之后不可修改。它有胶囊广场、AI 代笔、收藏与账号。</p>
            <p>
              它同时也是一个<b>多技术栈对比学习项目</b>的一部分。你正在使用的这一套，由下面的前端与后端技术栈实现，并遵循项目统一的 API 契约、数据库 schema 与设计令牌。
            </p>
          </div>
        </header>

        <section class="about__sec">
          <header class="sechead">
            <span class="sechead__no">壹</span>
            <div>
              <h2 class="h2">此刻运行的技术栈</h2>
              <p>页脚与这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p>
            </div>
          </header>
          <div class="about__live">
            <span class={`dot${h.online() ? " dot--on" : ""}`} />
            {h.online() === false ? "后端离线" : "后端在线"}
            <i />
            <span class="mono">GET /api/v1/health</span>
          </div>
          <div class="about__stack" data-testid="about-stack">
            <StackCard kind="前端" title="SolidJS" sub="frontends/solid" items={FRONTEND_STACK} summary={FRONTEND_SUMMARY} />
            <Show when={h.health()}>
              {(health) => (
                <StackCard
                  kind="后端"
                  title={h.backendName() ?? "后端"}
                  sub={health().stack.kind === "fullstack" ? "fullstack" : "backend"}
                  items={h.backend()}
                  summary={health().stack.summary}
                />
              )}
            </Show>
          </div>
        </section>

        <section class="about__sec">
          <header class="sechead">
            <span class="sechead__no">贰</span>
            <div>
              <h2 class="h2">它能做什么</h2>
              <p>一枚胶囊从写下到被读到，会经过的每一步。</p>
            </div>
          </header>
          <ol class="feats" data-testid="about-features">
            <For each={FEATURES}>
              {([, t, d], i) => (
                <li style={{ "--i": i() }} data-testid="about-feature">
                  <span class="feats__no latin">{String(i() + 1).padStart(2, "0")}</span>
                  <b class="serif">{t}</b>
                  <p>{d}</p>
                </li>
              )}
            </For>
          </ol>
        </section>

        <section class="about__sec">
          <header class="sechead">
            <span class="sechead__no">叁</span>
            <div>
              <h2 class="h2">四条原则</h2>
              <p>这个仓库为什么长成现在的样子。</p>
            </div>
          </header>
          <ol class="tenets" data-testid="about-tenets">
            <For each={TENETS}>
              {([t, d]) => (
                <li data-testid="about-tenet">
                  <b class="serif">{t}</b>
                  {/* 说明里可能含 <code>，内容是 lib/about.ts 的常量 */}
                  <p innerHTML={d} />
                </li>
              )}
            </For>
          </ol>
        </section>

        <section class="about__sec about__sec--end">
          <div class="credits">
            <div>
              <h3 class="serif">源码</h3>
              <p>
                全部实现都在同一个仓库里，按 <code class="mono">backends / frontends / fullstacks / desktop / mobile</code> 分目录；这一套在 <code class="mono">frontends/solid</code>。
              </p>
            </div>
            <div>
              <h3 class="serif">致谢</h3>
              <p>技术栈图标来自 Simple Icons 与各项目官方标识；字体来自思源宋体、Cormorant Garamond 与 IBM Plex Mono；感谢每一个开源框架的作者与维护者。</p>
            </div>
            <div>
              <h3 class="serif">许可</h3>
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
    <div class="page">
      <div class="wrap wrap--narrow detail">
        <div class="lost" data-testid="not-found">
          <div class="lost__mark">
            <Seal ch="迷" variant="line" />
          </div>
          <h1 class="h1">查无此页</h1>
          <p>
            这个地址没有对应的页面。
            <br />
            也许是链接抄错了一位，也许它从未存在过。
          </p>
          <div class="lost__act">
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
