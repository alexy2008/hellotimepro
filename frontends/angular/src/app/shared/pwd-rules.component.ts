// 密码规则：至少 8 位 / 含字母 / 含数字，满足的那条点亮。用法：<ul appPwdRules [value]="pwd"></ul>
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { pwdRules } from '@/lib/account';

@Component({
  selector: 'ul[appPwdRules]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'rules', 'aria-hidden': 'true' },
  template: `
    <li [class.is-ok]="r().len">至少 8 位</li>
    <li [class.is-ok]="r().alpha">含字母</li>
    <li [class.is-ok]="r().digit">含数字</li>
  `,
})
export class PwdRulesComponent {
  readonly value = input.required<string>();
  protected readonly r = computed(() => pwdRules(this.value()));
}
