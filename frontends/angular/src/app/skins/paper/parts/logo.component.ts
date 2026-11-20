// 品牌标：一枚印，印文是信封的折口——也像指向十点十分的表针
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'svg[appPaperLogo]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'logo', viewBox: '0 0 28 28', 'aria-hidden': 'true' },
  template: `
    <svg:rect width="28" height="28" rx="6" fill="var(--color-accent)" />
    <svg:path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--color-on-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    <svg:circle cx="14" cy="17" r="2.6" fill="var(--color-on-accent)" />
  `,
})
export class PaperLogoComponent {}
