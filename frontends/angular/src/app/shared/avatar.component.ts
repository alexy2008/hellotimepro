// 头像：<span appAvatar [avatar]="id" class="av--lg"></span>，spec/avatars/v2 的单线徽记，颜色由 --av 与皮肤样式决定
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { avatarOf } from '@/lib/avatars';

@Component({
  selector: 'span[appAvatar]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'av', 'aria-hidden': 'true', '[style.--av]': 'def().color' },
  template: `<svg viewBox="0 0 24 24" [innerHTML]="glyph()"></svg>`,
})
export class AvatarComponent {
  readonly avatar = input<string | null | undefined>();
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly def = computed(() => avatarOf(this.avatar()));
  /** 徽记是 spec 里的常量，不含用户输入 */
  protected readonly glyph = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.def().glyph));
}
