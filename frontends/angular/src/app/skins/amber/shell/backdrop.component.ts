// 「琥珀」背景：光晕 + 粒子画布 + 颗粒（「时笺」下由 shell.css 隐藏）。只在琥珀皮肤下绘制，换明暗时重启
import { ChangeDetectionStrategy, Component, effect, type ElementRef, inject, viewChild } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { CONTENTS } from '@/shared/host';
import { startSky } from './sky';

@Component({
  selector: 'app-amber-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="bg" aria-hidden="true">
      <div class="bg__aurora bg__aurora--a"></div>
      <div class="bg__aurora bg__aurora--b"></div>
      <div class="bg__aurora bg__aurora--c"></div>
      <canvas #canvas class="bg__canvas"></canvas>
      <div class="bg__grain"></div>
    </div>
  `,
})
export class AmberBackdropComponent {
  private readonly ui = inject(UiStore);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    // 换皮肤 / 换明暗时重启（onCleanup 先停掉上一轮）
    effect((onCleanup) => {
      if (this.ui.skin() !== 'amber') return;
      onCleanup(startSky(this.canvas().nativeElement, this.ui.theme() !== 'light'));
    });
  }
}
