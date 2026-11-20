// ============================================================
// 滑块：分段控件的 .seg__thumb、页签的墨线、琥珀顶栏的高亮底都用它。
// 放在滑块元素上：<span class="seg__thumb" appSliderThumb=".seg__opt.is-active" [sliderKey]="value()"></span>
// 它在父元素里找当前项，量出位置后把滑块挪过去。首次定位不带过渡；
// sliderKey 变了（选中项、数量、登录态…）在下一次渲染之后再量；窗口尺寸变化、字体晚到时也重新量。
// hideWhenNone：没有当前项时把滑块藏起来（琥珀顶栏在详情页之类没有高亮项）。
// ============================================================

import { afterNextRender, Directive, effect, ElementRef, inject, Injector, input } from '@angular/core';

@Directive({
  selector: '[appSliderThumb]',
  host: { '(window:resize)': 'place(false)' },
})
export class SliderThumbDirective {
  readonly appSliderThumb = input.required<string>();
  readonly sliderKey = input<unknown>();
  readonly hideWhenNone = input(false);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  constructor() {
    let first = true;
    effect(() => {
      this.sliderKey();
      const animate = !first;
      first = false;
      afterNextRender(() => this.place(animate), { injector: this.injector });
    });
    afterNextRender(() => void document.fonts?.ready.then(() => this.place(false)));
  }

  place(animate: boolean) {
    const s = this.el.style;
    const a = this.el.parentElement?.querySelector<HTMLElement>(this.appSliderThumb());
    if (!a) {
      if (this.hideWhenNone()) s.opacity = '0';
      return;
    }
    if (this.hideWhenNone()) s.opacity = '1';
    s.width = `${a.offsetWidth}px`;
    s.transform = `translateX(${a.offsetLeft}px)`;
    s.transition = animate ? '' : 'none';
  }
}
