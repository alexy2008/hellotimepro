// 删除确认框顶上的小插画：这枚胶囊打开的样子
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CONTENTS } from '@/shared/host';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';

@Component({
  selector: 'app-amber-delete-mark',
  imports: [AmberCapsuleArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `<div class="dlg__art"><svg appAmberCapsuleArt [code]="code()" state="opened" [width]="120"></svg></div>`,
})
export class AmberDeleteMarkComponent {
  readonly code = input.required<string>();
}
