// 皮肤切换：一组两个单选项（两套皮肤长得不一样，结构相同）。用法：<div appSkinSwitch></div>
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SKIN_LABEL, SKINS, type Skin, UiStore } from '@/stores/ui.store';
import { FeedbackStore } from '@/stores/feedback.store';

@Component({
  selector: 'div[appSkinSwitch]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'skinsw', role: 'radiogroup', 'aria-label': '界面皮肤' },
  template: `
    @for (k of skins; track k) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="ui.skin() === k"
        [class.is-active]="ui.skin() === k"
        [title]="'切换到「' + label[k] + '」'"
        data-testid="skin-option"
        [attr.data-value]="k"
        [attr.data-selected]="ui.skin() === k"
        (click)="pick(k)"
      >{{ label[k] }}</button>
    }
  `,
})
export class SkinSwitchComponent {
  protected readonly ui = inject(UiStore);
  private readonly feedback = inject(FeedbackStore);
  protected readonly skins = SKINS;
  protected readonly label = SKIN_LABEL;

  protected pick(k: Skin) {
    if (k === this.ui.skin()) return;
    void this.ui.setSkin(k).then(() => this.feedback.toast(`已切换到「${SKIN_LABEL[k]}」`));
  }
}
