// 创建页（/create）：提供 CreateFacade；要用当前用户的头像与昵称，user 到位才渲染
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { AuthStore } from '@/stores/auth.store';
import { CONTENTS } from '@/shared/host';
import { CreateFacade } from './create.facade';
import { PaperCreateComponent } from '@/skins/paper/create/create.component';
import { AmberCreateComponent } from '@/skins/amber/create/create.component';

@Component({
  selector: 'app-create-page',
  imports: [PaperCreateComponent, AmberCreateComponent],
  providers: [CreateFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (auth.user()) { @if (ui.skin() === 'paper') { <app-paper-create /> } @else { <app-amber-create /> } }`,
})
export class CreatePage {
  protected readonly ui = inject(UiStore);
  protected readonly auth = inject(AuthStore);
}
