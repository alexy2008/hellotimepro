// 广场搜索框：在页面任何地方按「/」聚焦它（焦点已经在输入框里时不抢）
import { Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: 'input[appSlashFocus]',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class SlashFocusDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  protected onKey(e: KeyboardEvent) {
    const tag = (document.activeElement?.tagName ?? '').toUpperCase();
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
      e.preventDefault();
      this.el.focus();
    }
  }
}
