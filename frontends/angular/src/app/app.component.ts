import { Component, effect, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { ThemeStore } from '@/stores/theme.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private auth = inject(AuthStore);
  private theme = inject(ThemeStore);

  constructor() {
    // 水合完成且有 refresh token 时，主动拉一次 /me 验证登录态
    effect(() => {
      if (this.auth.hydrated() && this.auth.refreshToken()) {
        void this.auth.refreshMe();
      }
    });
  }

  ngOnInit() {
    this.theme.hydrate();
    // auth store 的 hydrate 在 withHooks.onInit 中已自动触发
  }
}
