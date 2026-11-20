// 表单下方的一行结果：已保存 / 没有改动 / 出错。用法：<div appFormMsg [m]="msg()"></div>
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FormMsg } from '@/lib/account';
import { IconDirective } from './icon.directive';

@Component({
  selector: 'div[appFormMsg]',
  imports: [IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'form__msg', role: 'status', '[class]': "m() ? 'is-' + m()!.type : ''" },
  template: `
    @if (m(); as m) {
      <svg [appIcon]="m.type === 'err' ? 'alert' : m.type === 'ok' ? 'check' : 'info'"></svg><span>{{ m.text }}</span>
    }
  `,
})
export class FormMsgComponent {
  readonly m = input.required<FormMsg>();
}
