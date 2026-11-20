// 胶囊详情（/capsules/:code）：提供 CapsuleFacade，按皮肤渲染视图
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { CapsuleFacade } from './capsule.facade';
import { PaperCapsuleComponent } from '@/skins/paper/capsule/capsule.component';
import { AmberCapsuleComponent } from '@/skins/amber/capsule/capsule.component';

@Component({
  selector: 'app-capsule-page',
  imports: [PaperCapsuleComponent, AmberCapsuleComponent],
  providers: [CapsuleFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-capsule /> } @else { <app-amber-capsule /> }`,
})
export class CapsulePage {
  protected readonly ui = inject(UiStore);
}
