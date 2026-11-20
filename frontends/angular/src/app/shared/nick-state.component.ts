// 昵称右侧的状态点：格式通过打勾，不通过（或重名）打叉。用法：<span appNickState appTrail [state]="…"></span>
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { IconDirective } from './icon.directive';

export type NickStateValue = '' | 'valid' | 'invalid' | 'taken';

@Component({
  selector: 'span[appNickState]',
  imports: [IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.field__state]': "ui.skin() === 'paper'",
    '[class.input-wrap__action]': "ui.skin() !== 'paper'",
    '[class.nick-state]': "ui.skin() !== 'paper'",
    '[class.is-good]': 'good()',
    '[class.is-bad]': 'bad()',
    '[attr.data-testid]': "state() ? 'nickname-state' : null",
    '[attr.data-state]': 'state() || null',
  },
  template: `
    @if (good()) {
      <svg appIcon="check"></svg>
    } @else if (bad()) {
      <svg appIcon="x"></svg>
    }
  `,
})
export class NickStateComponent {
  readonly state = input.required<NickStateValue>();
  protected readonly ui = inject(UiStore);
  protected readonly good = computed(() => this.state() === 'valid');
  protected readonly bad = computed(() => this.state() === 'invalid' || this.state() === 'taken');
}
