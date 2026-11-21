// 首页就地输码：与开启页同一个部件（X3），满 8 位自动查询。输码状态由首页提供的 CodeOpener 管
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CodeOpener } from '@/shared/code-opener';
import { IconDirective } from '@/shared/icon.directive';
import { PaperCodeInputComponent } from '../parts/code-input.component';

@Component({
  selector: 'form[appPaperQuickOpen]',
  imports: [IconDirective, PaperCodeInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hquick', novalidate: '', '[class.is-full]': 'code.value().length === 8', '(submit)': 'submit($event)' },
  template: `
    <div class="hquick__k"><svg appIcon="key"></svg>已有胶囊码？在这里开启</div>
    <div class="hquick__row">
      <app-paper-code-input size="sm" [state]="code.state()" [shake]="code.shake()" (changed)="code.input($event)" (complete)="code.go($event)" />
      <button class="hquick__go" type="submit" aria-label="开启"><svg appIcon="arrow"></svg></button>
    </div>
    <div class="hquick__err" role="alert" [attr.data-testid]="code.error() ? 'open-error' : null">{{ code.error() }}</div>
  `,
})
export class PaperQuickOpenComponent {
  protected readonly code = inject(CodeOpener);

  protected submit(e: Event) {
    e.preventDefault();
    void this.code.go();
  }
}
