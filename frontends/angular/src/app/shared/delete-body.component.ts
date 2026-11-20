// 删除确认框的正文（spec/ui/copy.md §3）：标题与胶囊码走插值，照常转义
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CONTENTS } from './host';

@Component({
  selector: 'app-delete-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <p>《{{ title() }}》会被永久删除。持有胶囊码 <b class="mono">{{ code() }}</b> 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。</p>
    <p class="dlg__warn">此操作不可恢复。</p>
  `,
})
export class DeleteBodyComponent {
  readonly title = input.required<string>();
  readonly code = input.required<string>();
}
