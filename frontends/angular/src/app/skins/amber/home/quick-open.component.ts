// 首页就地输码：与开启页同一个部件（X3），满 8 位自动查询。输码状态由本组件提供的 CodeOpener 管
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CodeOpener } from '@/shared/code-opener';
import { IconDirective } from '@/shared/icon.directive';
import { AmberCodeInputComponent } from '../parts/code-input.component';

@Component({
  selector: 'form[appAmberQuickOpen]',
  imports: [IconDirective, AmberCodeInputComponent],
  providers: [CodeOpener],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'quick card', novalidate: '', '(submit)': 'submit($event)' },
  template: `
    <div class="quick__k"><svg appIcon="key"></svg>已有胶囊码？在这里开启</div>
    <div class="quick__row">
      <app-amber-code-input size="md" [state]="code.state()" [shake]="code.shake()" (changed)="code.input($event)" (complete)="code.go($event)" />
      <button class="btn btn--soft" type="submit">开启<svg appIcon="arrow"></svg></button>
    </div>
    <div class="quick__err" role="alert" [attr.data-testid]="code.error() ? 'open-error' : null">{{ code.error() }}</div>
  `,
})
export class AmberQuickOpenComponent {
  protected readonly code = inject(CodeOpener);

  protected submit(e: Event) {
    e.preventDefault();
    void this.code.go();
  }
}
