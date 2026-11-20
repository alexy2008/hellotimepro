// 「我的」列表底部的「加载更多」：还有下一页时才出现（测试钩子 list-next）
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CONTENTS } from './host';

@Component({
  selector: 'app-list-more',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @if (show()) {
      <div class="list-more">
        <button class="btn btn--ghost" [class.is-busy]="busy()" type="button" [disabled]="busy()" data-testid="list-next" (click)="more.emit()">
          {{ busy() ? '加载中…' : '加载更多（还有 ' + left() + ' 枚）' }}
        </button>
      </div>
    }
  `,
})
export class ListMoreComponent {
  readonly show = input.required<boolean>();
  readonly busy = input.required<boolean>();
  readonly left = input.required<number>();
  readonly more = output<void>();
}
