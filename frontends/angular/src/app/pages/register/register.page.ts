// 注册（/register）：提供 RegisterFacade——表单值跨皮肤保留，离开页面随宿主销毁
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { RegisterFacade } from './register.facade';
import { PaperRegisterComponent } from '@/skins/paper/account/register.component';
import { AmberRegisterComponent } from '@/skins/amber/account/register.component';

@Component({
  selector: 'app-register-page',
  imports: [PaperRegisterComponent, AmberRegisterComponent],
  providers: [RegisterFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-register /> } @else { <app-amber-register /> }`,
})
export class RegisterPage {
  protected readonly ui = inject(UiStore);
}
