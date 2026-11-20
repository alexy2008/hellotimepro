// 开启页（/open）：提供 OpenFacade 与 CodeOpener（输码状态切皮肤不丢）
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { OpenFacade } from './open.facade';
import { CodeOpener } from '@/shared/code-opener';
import { PaperOpenComponent } from '@/skins/paper/capsule/open.component';
import { AmberOpenComponent } from '@/skins/amber/capsule/open.component';

@Component({
  selector: 'app-open-page',
  imports: [PaperOpenComponent, AmberOpenComponent],
  providers: [OpenFacade, CodeOpener],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-open /> } @else { <app-amber-open /> }`,
})
export class OpenPage {
  protected readonly ui = inject(UiStore);
}
