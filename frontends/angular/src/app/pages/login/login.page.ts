// 登录（/login）：提供 LoginFacade——表单值跨皮肤保留，离开页面随宿主销毁
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { LoginFacade } from './login.facade';
import { PaperLoginComponent } from '@/skins/paper/account/login.component';
import { AmberLoginComponent } from '@/skins/amber/account/login.component';

@Component({
  selector: 'app-login-page',
  imports: [PaperLoginComponent, AmberLoginComponent],
  providers: [LoginFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-login /> } @else { <app-amber-login /> }`,
})
export class LoginPage {
  protected readonly ui = inject(UiStore);
}
