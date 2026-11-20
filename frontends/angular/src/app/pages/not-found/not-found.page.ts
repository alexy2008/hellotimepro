// 404：未匹配的路径
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { PaperNotFoundComponent } from '@/skins/paper/about/about.component';
import { AmberNotFoundComponent } from '@/skins/amber/about/about.component';

@Component({
  selector: 'app-not-found-page',
  imports: [PaperNotFoundComponent, AmberNotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `@if (ui.skin() === 'paper') { <app-paper-not-found /> } @else { <app-amber-not-found /> }`,
})
export class NotFoundPage {
  protected readonly ui = inject(UiStore);
}
