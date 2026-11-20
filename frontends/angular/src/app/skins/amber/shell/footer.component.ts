// 「琥珀」页脚：品牌 · 技术栈小片（前端 × 当前后端，来自 /health）· 版本
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FRONTEND_STACK, ROLE_LABEL } from '@/lib/about';
import { HealthService } from '@/core/health.service';
import { TechIconComponent } from '@/shared/tech-icon.component';
import type { StackItem } from '@/types';
import { AmberLogoComponent } from '../parts/logo.component';

/** 技术栈的一片：<span appAmberChip [it]="…"> */
@Component({
  selector: 'span[appAmberChip]',
  imports: [TechIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ftr__tech', '[title]': 'title()', 'data-testid': 'stack-item', '[attr.data-name]': 'it().name' },
  template: `<app-tech-icon [item]="it()" base="tech-ic" />{{ it().name }}`,
})
export class AmberChipComponent {
  readonly it = input.required<StackItem>();
  protected title() {
    const it = this.it();
    return `${ROLE_LABEL[it.role] ?? it.role} · ${it.name} ${it.version ?? ''}`;
  }
}

@Component({
  selector: 'footer[appAmberFooter]',
  imports: [RouterLink, AmberChipComponent, AmberLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ftr' },
  template: `
    <div class="ftr__in">
      <a class="ftr__brand" routerLink="/"><svg appAmberLogo [size]="22"></svg>HelloTime Pro · 时间胶囊</a>
      <div class="ftr__stack" data-testid="footer-stack">
        <span class="ftr__dot" [title]="h.online() === false ? '后端离线' : '后端在线'" [attr.data-online]="h.online()"></span>
        @for (it of front; track it.name) {
          <span appAmberChip [it]="it"></span>
        }
        @if (h.backend().length) {
          <i class="ftr__x">×</i>
        }
        @for (it of h.backend(); track it.role + it.name) {
          <span appAmberChip [it]="it"></span>
        }
      </div>
      <div class="ftr__meta"><span>把此刻，寄给未来</span><span class="mono">v2.0</span></div>
    </div>
  `,
})
export class AmberFooterComponent {
  protected readonly h = inject(HealthService);
  protected readonly front = FRONTEND_STACK;

  constructor() {
    this.h.load();
  }
}
