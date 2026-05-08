import { Component, input } from '@angular/core';

export type AlertVariant = 'info' | 'success' | 'danger';

const ICON: Record<AlertVariant, string> = {
  info: 'ⓘ',
  success: '✓',
  danger: '⚠',
};

@Component({
  selector: 'app-alert',
  standalone: true,
  template: `
    <div [class]="'cy-alert cy-alert--' + variant()">
      <span>{{ icon }}</span>
      <span><ng-content /></span>
    </div>
  `,
})
export class AlertComponent {
  variant = input<AlertVariant>('info');
  get icon() { return ICON[this.variant()]; }
}
