// 把宿主元素挪到 <body> 下（封缄仪式这类整页浮层）：页面容器带着入场动画的 transform，
// fixed 定位的浮层若留在里面会相对它定位。
// 要等 Angular 把节点插进页面之后再挪（@if 的视图是先创建、后插入），所以放在 afterNextRender 里；
// 销毁时 Angular 照常把节点移除，挪到哪儿都一样
import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';

@Directive({ selector: '[appPortal]' })
export class PortalDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => document.body.appendChild(el));
  }
}
