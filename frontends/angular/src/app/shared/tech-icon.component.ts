// 技术栈图标：有图就用后端托管的 SVG，没有就退成两个字。base 是皮肤给的类名（tech__ic / tech-ic）
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { StackItem } from '@/types';
import { CONTENTS } from './host';

@Component({
  selector: 'app-tech-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @if (item().iconUrl; as src) {
      <img [class]="base()" [src]="src" alt="" loading="lazy" />
    } @else {
      <span [class]="base() + ' ' + base() + '--txt'" aria-hidden="true">{{ short() }}</span>
    }
  `,
})
export class TechIconComponent {
  readonly item = input.required<Pick<StackItem, 'name' | 'iconUrl'>>();
  readonly base = input.required<string>();
  protected readonly short = computed(() => this.item().name.replace(/[^A-Za-z一-龥]/g, '').slice(0, 2));
}
