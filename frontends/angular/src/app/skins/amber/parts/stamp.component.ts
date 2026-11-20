// 邮戳：外圈文字沿圆排布，略微歪斜，像用手盖上去的。组件长在 <svg> 上
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FmtPipe } from '@/shared/fmt.pipe';
import { nextId } from './art';

@Component({
  selector: 'svg[appAmberStamp]',
  imports: [FmtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'stamp', viewBox: '0 0 140 140', 'aria-hidden': 'true' },
  template: `
    <svg:defs><svg:path [attr.id]="id" d="M18 70a52 52 0 1 1 104 0a52 52 0 1 1-104 0" /></svg:defs>
    <svg:circle class="stamp__ring" cx="70" cy="70" r="66" />
    <svg:circle class="stamp__ring stamp__ring--in" cx="70" cy="70" r="40" />
    <svg:text class="stamp__arc"><svg:textPath [attr.href]="'#' + id" textLength="316" lengthAdjust="spacing">HELLOTIME PRO · 时间胶囊 · TIME CAPSULE ·</svg:textPath></svg:text>
    <svg:text class="stamp__label" x="70" y="68" text-anchor="middle">{{ label() }}</svg:text>
    <svg:text class="stamp__date" x="70" y="86" text-anchor="middle">{{ date() | fmt: 'date' }}</svg:text>
  `,
})
export class AmberStampComponent {
  readonly date = input.required<number>();
  readonly label = input('已开启');
  protected readonly id = nextId('st');
}
