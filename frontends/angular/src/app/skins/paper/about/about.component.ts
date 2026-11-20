// ============================================================
// 「时笺」关于（/about）与 404
// 结构与类名照 2.0 原型 paper/view-about.js；只展示本实现自己的前后端技术栈
// ============================================================

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FEATURES, FRONTEND_STACK, FRONTEND_SUMMARY, ROLE_LABEL, TECH_NOTE, TENETS } from '@/lib/about';
import { HealthService } from '@/core/health.service';
import { IconDirective } from '@/shared/icon.directive';
import { TechIconComponent } from '@/shared/tech-icon.component';
import { CONTENTS } from '@/shared/host';
import type { StackItem } from '@/types';
import { PaperSealComponent } from '../parts/seal.component';

/** 技术栈卡：一张「规格单」。用法：<article appPaperStackCard …> */
@Component({
  selector: 'article[appPaperStackCard]',
  imports: [TechIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'spec' },
  template: `
    <header class="spec__head">
      <div>
        <div class="spec__k">{{ kind() }}</div>
        <h3 class="spec__t serif">{{ heading() }}</h3>
      </div>
      <span class="spec__sub mono">{{ sub() }}</span>
    </header>
    <ul class="spec__list">
      @for (it of items(); track it.role + it.name) {
        <li class="tech" data-testid="stack-item" [attr.data-name]="it.name">
          <app-tech-icon [item]="it" base="tech__ic" />
          <div class="tech__main">
            <b>{{ it.name }}<small class="mono">{{ it.version }}</small></b>
            <span>{{ note[it.name] ?? '' }}</span>
          </div>
          <em class="tech__role">{{ role[it.role] ?? it.role }}</em>
        </li>
      }
    </ul>
    <p class="spec__sum">{{ summary() }}</p>
  `,
})
export class PaperStackCardComponent {
  readonly kind = input.required<string>();
  readonly heading = input.required<string>();
  readonly sub = input.required<string>();
  readonly items = input.required<StackItem[]>();
  readonly summary = input.required<string>();
  protected readonly note = TECH_NOTE;
  protected readonly role = ROLE_LABEL;
}

@Component({
  selector: 'app-paper-about',
  imports: [PaperStackCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page page--about">
      <div class="wrap about">
        <header class="about__hero">
          <div class="overline"><i></i>About</div>
          <h1 class="about__title">
            <span>有些话，</span>
            <span>要<em>等一等</em>再说<i class="about__stop"></i></span>
          </h1>
          <div class="about__lede">
            <p>HelloTime Pro 是一款时间胶囊应用：写下一段话，设定未来某一刻才能开启，封存之后不可修改。它有胶囊广场、AI 代笔、收藏与账号。</p>
            <p>它同时也是一个<b>多技术栈对比学习项目</b>的一部分。你正在使用的这一套，由下面的前端与后端技术栈实现，并遵循项目统一的 API 契约、数据库 schema 与设计令牌。</p>
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
            <span class="dot" [class.dot--on]="h.online()"></span>{{ h.online() === false ? '后端离线' : '后端在线' }}<i></i><span class="mono">GET /api/v1/health</span>
          </div>
          <div class="about__stack" data-testid="about-stack">
            <article appPaperStackCard kind="前端" heading="Angular" sub="frontends/angular" [items]="front" [summary]="summary"></article>
            @if (h.health(); as health) {
              <article
                appPaperStackCard
                kind="后端"
                [heading]="h.backendName() ?? '后端'"
                [sub]="health.stack.kind === 'fullstack' ? 'fullstack' : 'backend'"
                [items]="h.backend()"
                [summary]="health.stack.summary"
              ></article>
            }
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
            @for (ft of features; track ft[1]; let i = $index) {
              <li [style.--i]="i" data-testid="about-feature">
                <span class="feats__no latin">{{ i < 9 ? '0' + (i + 1) : i + 1 }}</span><b class="serif">{{ ft[1] }}</b>
                <p>{{ ft[2] }}</p>
              </li>
            }
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
            @for (t of tenets; track t[0]) {
              <!-- 说明里含 <code>，内容是 lib/about.ts 的常量 -->
              <li data-testid="about-tenet"><b class="serif">{{ t[0] }}</b><p [innerHTML]="t[1]"></p></li>
            }
          </ol>
        </section>

        <section class="about__sec about__sec--end">
          <div class="credits">
            <div>
              <h3 class="serif">源码</h3>
              <p>全部实现都在同一个仓库里，按 <code class="mono">backends / frontends / fullstacks / desktop / mobile</code> 分目录；这一套在 <code class="mono">frontends/angular</code>。</p>
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
  `,
})
export class PaperAboutComponent {
  protected readonly h = inject(HealthService);
  protected readonly front = FRONTEND_STACK;
  protected readonly summary = FRONTEND_SUMMARY;
  protected readonly features = FEATURES;
  protected readonly tenets = TENETS;

  constructor() {
    this.h.load();
  }
}

@Component({
  selector: 'app-paper-not-found',
  imports: [RouterLink, IconDirective, PaperSealComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page">
      <div class="wrap wrap--narrow detail">
        <div class="lost" data-testid="not-found">
          <div class="lost__mark"><span appPaperSeal ch="迷" variant="line"></span></div>
          <h1 class="h1">查无此页</h1>
          <p>这个地址没有对应的页面。<br />也许是链接抄错了一位，也许它从未存在过。</p>
          <div class="lost__act">
            <a class="btn btn--primary" routerLink="/">回到广场</a>
            <a class="btn btn--ghost" routerLink="/open"><svg appIcon="key"></svg>凭码开启</a>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PaperNotFoundComponent {}
