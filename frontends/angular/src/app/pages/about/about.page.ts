// 关于（/about）：文字两套皮肤共用（lib/about.ts），排版各一份
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { PaperAboutComponent } from '@/skins/paper/about/about.component';
import { AmberAboutComponent } from '@/skins/amber/about/about.component';

@Component({
  selector: 'app-about-page',
  imports: [PaperAboutComponent, AmberAboutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-about /> } @else { <app-amber-about /> }`,
})
export class AboutPage {
  protected readonly ui = inject(UiStore);
}
