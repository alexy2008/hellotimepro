// 卡片上的短倒计时：超过一天显示「N 天 hh:mm:ss」
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { fmt, pad2 } from '@/lib/fmt';
import { CONTENTS } from '@/shared/host';

@Component({
  selector: 'app-paper-cd-short',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @if (c().d > 0) {
      <b class="latin">{{ days() }}</b><small>天</small><span class="mono">{{ hms() }}</span>
    } @else {
      <b class="mono cap__cd-hms">{{ hms() }}</b>
    }
  `,
})
export class PaperCdShortComponent {
  readonly openAt = input.required<number>();
  readonly now = input.required<number>();
  protected readonly c = computed(() => fmt.cd(this.openAt(), this.now()));
  protected readonly days = computed(() => fmt.num(this.c().d));
  protected readonly hms = computed(() => `${pad2(this.c().h)}:${pad2(this.c().m)}:${pad2(this.c().s)}`);
}
