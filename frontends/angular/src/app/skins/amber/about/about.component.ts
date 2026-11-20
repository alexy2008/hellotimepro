// ============================================================
// 「琥珀」关于（/about）与 404
// 结构与类名照 2.0 原型 amber/view-about.js；只展示本实现自己的前后端技术栈
// ============================================================

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FEATURES, FRONTEND_STACK, FRONTEND_SUMMARY, ROLE_LABEL, TECH_NOTE, TENETS } from '@/lib/about';
import { HealthService } from '@/core/health.service';
import { IconDirective } from '@/shared/icon.directive';
import { TechIconComponent } from '@/shared/tech-icon.component';
import { CONTENTS } from '@/shared/host';
import type { StackItem } from '@/types';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';
import { AmberLogoComponent } from '../parts/logo.component';

/** 技术栈卡：<article appAmberStackCard …> */
@Component({
  selector: 'article[appAmberStackCard]',
  imports: [TechIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card card--pad stack-card' },
  template: `
    <div class="eyebrow">{{ en() }}</div>
    <h2 class="card__title">{{ kind() }}<small class="mono">{{ path() }}</small></h2>
    <p class="card__lead">{{ summary() }}</p>
    <ul class="stack-list">
      @for (it of items(); track it.role + it.name) {
        <li data-testid="stack-item" [attr.data-name]="it.name">
          <span class="stack-list__ic"><app-tech-icon [item]="it" base="tech-ic" /></span>
          <div><b>{{ it.name }}<small class="mono">{{ it.version }}</small></b><span>{{ note[it.name] ?? '' }}</span></div>
          <em>{{ role[it.role] ?? it.role }}</em>
        </li>
      }
    </ul>
  `,
})
export class AmberStackCardComponent {
  readonly kind = input.required<string>();
  readonly en = input.required<string>();
  readonly path = input.required<string>();
  readonly items = input.required<StackItem[]>();
  readonly summary = input.required<string>();
  protected readonly note = TECH_NOTE;
  protected readonly role = ROLE_LABEL;
}

@Component({
  selector: 'app-amber-about',
  imports: [IconDirective, AmberLogoComponent, AmberStackCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page page--about">
      <div class="container about">
        <header class="about__hero">
          <div class="about__badge"><span class="about__ring"></span><svg appAmberLogo [size]="112"></svg></div>
          <div>
            <div class="eyebrow">About</div>
            <h1 class="about__title">HelloTime Pro <span class="pill mono">v2.0</span></h1>
            <p class="about__motto">有些话，要等一等再说。</p>
            <p class="page-lead">一款时间胶囊应用：写下一段话，设定一个未来的时刻，封存之后谁也打不开，直到那一刻到来。你可以把它发布到广场，也可以只把胶囊码交给一个人。</p>
          </div>
        </header>

        <section class="about__sec">
          <div class="eyebrow">Tech stack</div>
          <h2 class="section-title">此刻运行的技术栈</h2>
          <p class="page-lead">页脚和这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p>
          <div class="about__live"><span class="ftr__dot"></span>{{ h.online() === false ? '后端离线' : '后端在线' }} · <span class="mono">GET /api/v1/health</span></div>
          <div class="about__stacks" data-testid="about-stack">
            <article appAmberStackCard kind="前端" en="Frontend" path="frontends/angular" [items]="front" [summary]="summary"></article>
            @if (h.health(); as health) {
              <article appAmberStackCard [kind]="'后端 · ' + (h.backendName() ?? '后端')" en="Backend" [path]="health.stack.kind" [items]="h.backend()" [summary]="health.stack.summary"></article>
            }
          </div>
        </section>

        <section class="about__sec">
          <div class="eyebrow">Features</div>
          <h2 class="section-title">它能做什么</h2>
          <div class="features" data-testid="about-features">
            @for (ft of features; track ft[1]; let i = $index) {
              <article class="feature card" [style.--i]="i" data-testid="about-feature">
                <span class="feature__ic"><svg [appIcon]="ft[0]"></svg></span>
                <h3>{{ ft[1] }}</h3>
                <p>{{ ft[2] }}</p>
              </article>
            }
          </div>
        </section>

        <section class="about__sec card card--pad dnotes">
          <div class="eyebrow">Principles</div>
          <h2 class="section-title">四条原则</h2>
          <p class="card__lead">这个仓库为什么长成现在的样子。</p>
          <div class="dnotes__grid dnotes__grid--4" data-testid="about-tenets">
            @for (t of tenets; track t[0]) {
              <!-- 说明里含 <code>，内容是 lib/about.ts 的常量 -->
              <div data-testid="about-tenet"><h3>{{ t[0] }}</h3><p [innerHTML]="t[1]"></p></div>
            }
          </div>
        </section>

        <section class="about__sec about__credits">
          <div>
            <h3><svg appIcon="code"></svg>源码</h3>
            <p>实现位于仓库的 <code class="mono">frontends/angular</code> 与 <code class="mono">backends/</code> 目录。</p>
          </div>
          <div>
            <h3><svg appIcon="heart"></svg>致谢</h3>
            <p>技术栈图标来自 Simple Icons 与各项目官方标识；感谢每一个开源框架的作者与维护者。</p>
          </div>
          <div>
            <h3><svg appIcon="book"></svg>许可</h3>
            <p>MIT License。本项目用于教学与研究，不面向生产环境。</p>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AmberAboutComponent {
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
  selector: 'app-amber-not-found',
  imports: [RouterLink, IconDirective, AmberCapsuleArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page">
      <div class="container">
        <div class="notice card" data-testid="not-found">
          <div class="notice__float"><svg appAmberCapsuleArt code="NOWHERE0" state="opened" [width]="220"></svg></div>
          <div class="eyebrow eyebrow--center">404</div>
          <h1 class="page-title">这一页飘走了</h1>
          <p class="page-lead">这个地址没有对应的页面。也许是链接抄错了一位，也许它从未存在过。</p>
          <div class="notice__act">
            <a class="btn btn--primary" routerLink="/">回到广场</a>
            <a class="btn btn--ghost" routerLink="/open"><svg appIcon="key"></svg>凭码开启</a>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AmberNotFoundComponent {}
