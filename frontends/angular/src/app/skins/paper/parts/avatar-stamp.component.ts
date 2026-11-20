// 邮票：头像徽记 + 齿孔边（label=false 时不写名字）。用法：<span appPaperAvatarStamp [avatar]="id" class="stamp--lg"></span>
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { avatarOf } from '@/lib/avatars';

@Component({
  selector: 'span[appPaperAvatarStamp]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'stamp', '[style.--av]': 'def().color' },
  template: `
    <span class="stamp__in">
      <svg viewBox="0 0 24 24" aria-hidden="true" [innerHTML]="glyph()"></svg>
      @if (label()) {
        <b>{{ def().name }}</b>
      }
    </span>
  `,
})
export class PaperAvatarStampComponent {
  readonly avatar = input.required<string>();
  readonly label = input(true);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly def = computed(() => avatarOf(this.avatar()));
  protected readonly glyph = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.def().glyph));
}
