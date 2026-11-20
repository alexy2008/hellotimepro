// 时笺的品牌标（页头与页脚共用）：<a appPaperBrand routerLink="/">
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PaperLogoComponent } from '../parts/logo.component';

@Component({
  selector: 'a[appPaperBrand]',
  imports: [PaperLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'brand' },
  template: `<svg appPaperLogo></svg><span class="brand__name latin">HelloTime</span><sup class="brand__pro mono">PRO</sup>`,
})
export class PaperBrandComponent {}
