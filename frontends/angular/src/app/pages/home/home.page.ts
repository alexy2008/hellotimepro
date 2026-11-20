// 首页 = 胶囊广场（/）：提供 HomeFacade，按皮肤渲染视图
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { HomeFacade } from './home.facade';
import { PaperHomeComponent } from '@/skins/paper/home/home.component';
import { AmberHomeComponent } from '@/skins/amber/home/home.component';

@Component({
  selector: 'app-home-page',
  imports: [PaperHomeComponent, AmberHomeComponent],
  providers: [HomeFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-home /> } @else { <app-amber-home /> }`,
})
export class HomePage {
  protected readonly ui = inject(UiStore);
}
