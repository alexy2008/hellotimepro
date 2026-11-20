// 空状态：一枚打开（或合上）的胶囊 + 标题 + 说明 + 投影进来的按钮。用法：<div appAmberEmpty title="…" text="…">按钮</div>
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AmberCapsuleArtComponent } from './capsule-art.component';

@Component({
  selector: 'div[appAmberEmpty]',
  imports: [AmberCapsuleArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'empty', '[attr.data-testid]': 'testid()' },
  template: `
    <svg appAmberCapsuleArt [code]="null" [state]="state()" [width]="170" class="empty__art"></svg>
    <h3 class="empty__title">{{ heading() }}</h3>
    <p>{{ text() }}</p>
    <ng-content />
  `,
})
export class AmberEmptyComponent {
  readonly heading = input.required<string>();
  readonly text = input.required<string>();
  readonly state = input<'locked' | 'opened'>('opened');
  readonly testid = input('list-empty');
}
