// 标志：一枚被时间轨道环绕的倾斜胶囊（插画固定配色，不随主题变）。组件长在 <svg> 上，图形带 svg: 前缀
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { nextId } from './art';

@Component({
  selector: 'svg[appAmberLogo]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'logo', viewBox: '0 0 64 64', 'aria-hidden': 'true', '[attr.width]': 'size()', '[attr.height]': 'size()' },
  template: `
    <svg:defs>
      <svg:linearGradient [attr.id]="u + 'n'" x1="0" y1="0" x2="1" y2="1"><svg:stop offset="0" stop-color="#34267e" /><svg:stop offset="1" stop-color="#0a0e28" /></svg:linearGradient>
      <svg:linearGradient [attr.id]="u + 'a'" x1="0" y1="0" x2="1" y2="1">
        <svg:stop offset="0" stop-color="#ffe59a" /><svg:stop offset=".5" stop-color="#ffb347" /><svg:stop offset="1" stop-color="#ff7a45" />
      </svg:linearGradient>
      <svg:linearGradient [attr.id]="u + 'g'" x1="0" y1="0" x2="1" y2="1"><svg:stop offset="0" stop-color="#fff" /><svg:stop offset="1" stop-color="#c9d1ff" /></svg:linearGradient>
      <svg:radialGradient [attr.id]="u + 'w'" cx=".5" cy=".5" r=".5">
        <svg:stop offset="0" stop-color="#ffb347" stop-opacity=".55" /><svg:stop offset="1" stop-color="#ffb347" stop-opacity="0" />
      </svg:radialGradient>
    </svg:defs>
    <svg:rect width="64" height="64" rx="15" [attr.fill]="'url(#' + u + 'n)'" />
    <svg:circle cx="32" cy="32" r="24" [attr.fill]="'url(#' + u + 'w)'" />
    <svg:g transform="rotate(45 32 32)">
      <svg:path d="M5 32A27 8 0 0 1 59 32" fill="none" stroke="#b9afff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.5 3.4" />
      <svg:path d="M22 32V22a10 10 0 0 1 20 0v10Z" [attr.fill]="'url(#' + u + 'a)'" />
      <svg:path d="M22 32v10a10 10 0 0 0 20 0V32Z" [attr.fill]="'url(#' + u + 'g)'" />
      <svg:rect x="26.5" y="35.5" width="11" height="10.5" rx="2" fill="#ffd98a" fill-opacity=".9" />
      <svg:path d="M28.8 39h6.4M28.8 42h4.6" stroke="#b06a1c" stroke-width="1.1" stroke-linecap="round" />
      <svg:rect x="20.6" y="30.4" width="22.8" height="3.2" rx="1.6" fill="#1b1550" />
      <svg:path d="M26.2 23a5.8 5.8 0 0 1 4.2-5.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2" stroke-linecap="round" />
      <svg:path d="M5 32A27 8 0 0 0 59 32" fill="none" stroke="#d9d3ff" stroke-width="1.8" stroke-linecap="round" />
      <svg:circle cx="51" cy="37.2" r="2.6" fill="#ffd27a" />
    </svg:g>
    <svg:path d="M13 43q.5 3.5 4 4-3.5.5-4 4-.5-3.5-4-4 3.5-.5 4-4Z" fill="#ffe59a" />
    <svg:circle cx="50.5" cy="13.5" r="1.4" fill="#fff" fill-opacity=".9" />
    <svg:circle cx="44" cy="8.5" r=".8" fill="#fff" fill-opacity=".6" />
  `,
})
export class AmberLogoComponent {
  readonly size = input(34);
  protected readonly u = nextId('lg');
}
