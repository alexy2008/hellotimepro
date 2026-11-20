// 延迟自动聚焦：等入场动画走一会儿再聚焦，且只在用户还没把焦点放到别处时生效
import { DestroyRef, Directive, ElementRef, inject, input, type OnInit } from '@angular/core';
import { focusIfIdle } from '@/lib/fmt';

@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective implements OnInit {
  /** 延迟毫秒数（不写就是 380） */
  readonly appAutofocus = input<number | ''>('');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit() {
    // 信号输入在构造函数里还没绑定，到 ngOnInit 才读得到
    const t = window.setTimeout(() => focusIfIdle(this.el), Number(this.appAutofocus()) || 380);
    this.destroyRef.onDestroy(() => clearTimeout(t));
  }
}
