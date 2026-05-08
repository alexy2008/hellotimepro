import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '@/components/app-header/app-header.component';
import { AppFooterComponent } from '@/components/app-footer/app-footer.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, AppFooterComponent],
  template: `
    <app-header />
    <router-outlet />
    <app-footer />
  `,
})
export class MainLayoutComponent {}
