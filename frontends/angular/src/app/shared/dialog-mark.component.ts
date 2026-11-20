// 确认框顶部的小标记：时笺盖一枚朱文印，琥珀是一个图标（登录提示、删除确认都用）
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import type { IconName } from '@/lib/icons';
import { IconDirective } from './icon.directive';
import { PaperSealComponent } from '@/skins/paper/parts/seal.component';
import { CONTENTS } from './host';

@Component({
  selector: 'app-dialog-mark',
  imports: [IconDirective, PaperSealComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="dlg__mark">
      @if (ui.skin() === 'paper') {
        <span appPaperSeal [ch]="ch()" variant="line"></span>
      } @else {
        <svg [appIcon]="icon()"></svg>
      }
    </div>
  `,
})
export class DialogMarkComponent {
  readonly ch = input.required<string>();
  readonly icon = input.required<IconName>();
  protected readonly ui = inject(UiStore);
}
