// 「时笺」页脚：品牌题记 + 「本页由以下技术栈排印」（前端 × 当前后端，来自 /health）
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FRONTEND_STACK, ROLE_LABEL } from '@/lib/about';
import { HealthService } from '@/core/health.service';
import { TechIconComponent } from '@/shared/tech-icon.component';
import type { StackItem } from '@/types';
import { PaperBrandComponent } from './brand.component';

/** 技术栈的一项：<li appPaperStackLi [it]="…"> */
@Component({
  selector: 'li[appPaperStackLi]',
  imports: [TechIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[title]': 'role()', 'data-testid': 'stack-item', '[attr.data-name]': 'it().name' },
  template: `<app-tech-icon [item]="it()" base="tech__ic" /><span>{{ it().name }}</span><small class="mono">{{ it().version }}</small>`,
})
export class PaperStackLiComponent {
  readonly it = input.required<StackItem>();
  protected role() {
    return ROLE_LABEL[this.it().role] ?? this.it().role;
  }
}

@Component({
  selector: 'footer[appPaperFooter]',
  imports: [RouterLink, PaperBrandComponent, PaperStackLiComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ftr' },
  template: `
    <div class="wrap ftr__in">
      <div class="ftr__brand">
        <a appPaperBrand routerLink="/"></a>
        <p class="ftr__motto serif">把此刻，寄给未来。</p>
        <p class="ftr__fine">一个多技术栈对比学习项目 · 不面向生产</p>
      </div>
      <div class="ftr__colo">
        <div class="ftr__k">
          <span>本页由以下技术栈排印</span>
          <span class="ftr__live"
            ><span class="dot" [class.dot--on]="h.online()"></span
            >{{ h.online() === false ? '后端离线' : h.online() ? '后端在线 · ' + (h.backendName() ?? '') : '连接中…' }}</span
          >
        </div>
        <ul class="stack" data-testid="footer-stack">
          @for (it of front; track it.name) {
            <li appPaperStackLi [it]="it"></li>
          }
          @if (h.backend().length) {
            <li class="stack__x" aria-hidden="true">×</li>
          }
          @for (it of h.backend(); track it.role + it.name) {
            <li appPaperStackLi [it]="it"></li>
          }
        </ul>
      </div>
    </div>
    <div class="wrap ftr__base">
      <span>© 2026 HelloTime Pro · MIT License</span>
      <nav aria-label="页脚">
        <a routerLink="/">广场</a>
        <a routerLink="/open">开启</a>
        <a routerLink="/about">关于</a>
      </nav>
    </div>
  `,
})
export class PaperFooterComponent {
  protected readonly h = inject(HealthService);
  protected readonly front = FRONTEND_STACK;

  constructor() {
    this.h.load();
  }
}
