// ============================================================
// 翻牌倒计时：天 / 时 / 分 / 秒。每一位以「位置 + 数字」作 track，
// 某一位变了就重新创建，从而重播「落下」的动画。用法：<div appAmberCountdown [openAt]="…" [now]="…">
// ============================================================

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { fmt, pad2 } from '@/lib/fmt';
import { KeyDirective } from '@/shared/key.directive';

@Component({
  selector: 'div[appAmberCountdown]',
  imports: [KeyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cd', role: 'timer', '[attr.aria-label]': 'label()' },
  template: `
    @for (u of units(); track u.k; let first = $first) {
      @if (!first) {
        <div class="cd__sep" aria-hidden="true">:</div>
      }
      <div class="cd__unit" [class.cd__unit--accent]="u.k === 's'">
        <div class="cd__digits">
          @for (d of u.digits; track $index) {<span *appKey="d" class="cd__digit">{{ d }}</span>}
        </div>
        <div class="cd__label">{{ u.l }}</div>
      </div>
    }
  `,
})
export class AmberCountdownComponent {
  readonly openAt = input.required<number>();
  readonly now = input.required<number>();
  private readonly c = computed(() => fmt.cd(this.openAt(), this.now()));
  protected readonly units = computed(() => {
    const c = this.c();
    return [
      { k: 'd', l: '天', digits: Array.from(String(c.d).padStart(2, '0')) },
      { k: 'h', l: '时', digits: Array.from(pad2(c.h)) },
      { k: 'm', l: '分', digits: Array.from(pad2(c.m)) },
      { k: 's', l: '秒', digits: Array.from(pad2(c.s)) },
    ];
  });
  protected readonly label = computed(() => {
    const c = this.c();
    return `距离开启还有 ${c.d} 天 ${c.h} 小时 ${c.m} 分 ${c.s} 秒`;
  });
}
