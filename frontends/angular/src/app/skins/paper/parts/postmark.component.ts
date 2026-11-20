// 邮戳：外圈两行弧形字，中间两行日期。组件直接长在 <svg> 上，所以模板里的图形都带 svg: 前缀
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { nextId } from './art';

@Component({
  selector: 'svg[appPaperPostmark]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pm', viewBox: '0 0 172 120', 'aria-hidden': 'true' },
  template: `
    <svg:defs>
      <svg:path [attr.id]="id + 'a'" d="M16.5,60 a43.5,43.5 0 1,1 87,0" />
      <svg:path [attr.id]="id + 'b'" d="M9.5,60 a50.5,50.5 0 0,0 101,0" />
    </svg:defs>
    <svg:g class="pm__ring">
      <svg:circle cx="60" cy="60" r="56" />
      <svg:circle cx="60" cy="60" r="37" />
    </svg:g>
    <svg:text class="pm__arc"><svg:textPath [attr.href]="'#' + id + 'a'" startOffset="50%" text-anchor="middle">{{ top() }}</svg:textPath></svg:text>
    <svg:text class="pm__arc pm__arc--cn"><svg:textPath [attr.href]="'#' + id + 'b'" startOffset="50%" text-anchor="middle">{{ bottom() }}</svg:textPath></svg:text>
    <svg:text class="pm__l1" x="60" y="59" text-anchor="middle">{{ line1() }}</svg:text>
    <svg:text class="pm__l2" x="60" y="74" text-anchor="middle">{{ line2() }}</svg:text>
    <svg:g class="pm__waves">
      @for (y of waves; track y) {
        <svg:path [attr.d]="'M120 ' + y + 'q6.5-5 13 0t13 0 13 0 13 0'" />
      }
    </svg:g>
  `,
})
export class PaperPostmarkComponent {
  readonly line1 = input('');
  readonly line2 = input('');
  readonly top = input('HELLOTIME · POST');
  readonly bottom = input('时 光 邮 局');
  protected readonly id = nextId('pm');
  protected readonly waves = [34, 47, 60, 73, 86];
}
