// 我的（/me/:tab）：提供 MeFacade 与 ProfileFacade；三个页签共用这一个宿主
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { AuthStore } from '@/stores/auth.store';
import { CONTENTS } from '@/shared/host';
import { MeFacade } from './me.facade';
import { ProfileFacade } from './profile.facade';
import { PaperMeComponent } from '@/skins/paper/account/me.component';
import { AmberMeComponent } from '@/skins/amber/account/me.component';

@Component({
  selector: 'app-me-page',
  imports: [PaperMeComponent, AmberMeComponent],
  providers: [MeFacade, ProfileFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (auth.user()) { @if (ui.skin() === 'paper') { <app-paper-me /> } @else { <app-amber-me /> } }`,
})
export class MePage {
  protected readonly ui = inject(UiStore);
  protected readonly auth = inject(AuthStore);
}
