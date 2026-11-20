// 线性图标：<svg appIcon="pen" class="ic--go"></svg>。指令直接长在 <svg> 上，
// 路径是 lib/icons.ts 里的常量（不含用户输入），信任后写进 innerHTML
import { computed, Directive, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICONS, type IconName } from '@/lib/icons';

@Directive({
  selector: 'svg[appIcon]',
  host: { class: 'ic', viewBox: '0 0 24 24', 'aria-hidden': 'true', '[innerHTML]': 'html()' },
})
export class IconDirective {
  readonly appIcon = input.required<IconName>();
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly html = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.appIcon()]));
}
