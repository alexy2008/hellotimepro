// 提示条容器：页面底部居中，逐条淡入淡出
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeedbackStore } from '@/stores/feedback.store';
import { IconDirective } from './icon.directive';
import { CONTENTS } from './host';

@Component({
  selector: 'app-toast-host',
  imports: [IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of feedback.toasts(); track t.id) {
        <div data-testid="toast" [attr.data-tone]="t.tone" [class]="'toast toast--' + cls[t.tone]" [class.is-in]="t.shown">
          <svg [appIcon]="icon[t.tone]"></svg><span>{{ t.msg }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly feedback = inject(FeedbackStore);
  protected readonly cls = { error: 'err', info: 'info', success: 'ok' } as const;
  protected readonly icon = { error: 'alert', info: 'info', success: 'check' } as const;
}
