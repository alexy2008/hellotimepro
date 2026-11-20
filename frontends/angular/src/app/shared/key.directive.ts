// ============================================================
// 结构型指令 *appKey="value"：值一变就把模板整个重建一次（相当于 React 的 key / Vue 的 :key）。
// 用来重播入场动画——翻牌数字、收藏的 is-pop、日历圈、「我的」页签切换的 is-swap。
// ============================================================

import { Directive, effect, inject, input, TemplateRef, untracked, ViewContainerRef } from '@angular/core';

@Directive({ selector: '[appKey]' })
export class KeyDirective {
  readonly appKey = input<unknown>();

  constructor() {
    const vcr = inject(ViewContainerRef);
    const tpl = inject(TemplateRef);
    effect(() => {
      this.appKey();
      untracked(() => {
        vcr.clear();
        vcr.createEmbeddedView(tpl);
      });
    });
  }
}
