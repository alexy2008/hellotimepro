// 徽标：<span appAmberBadge kind="locked" icon="lock">封存中</span>
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { IconName } from '@/lib/icons';
import { IconDirective } from '@/shared/icon.directive';

@Component({
  selector: 'span[appAmberBadge]',
  imports: [IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'badge badge--' + kind()" },
  template: `@if (icon(); as ic) {<svg [appIcon]="ic"></svg>}<ng-content />`,
})
export class AmberBadgeComponent {
  readonly kind = input.required<string>();
  readonly icon = input<IconName>();
}

/** 公开与否：广场公开 / 仅凭码可见 */
@Component({
  selector: 'span[appAmberVisBadge]',
  imports: [IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "inPlaza() ? 'badge badge--plaza' : 'badge badge--private'" },
  template: `<svg [appIcon]="inPlaza() ? 'globe' : 'lock'"></svg>{{ inPlaza() ? '广场公开' : '仅凭码可见' }}`,
})
export class AmberVisBadgeComponent {
  readonly inPlaza = input.required<boolean>();
}
