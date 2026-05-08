import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { ApiError } from '@/types';
import { AlertComponent } from '@/components/alert/alert.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, AlertComponent],
  template: `
    <main class="cy-container cy-container--narrow"
      style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
      <div class="cy-card" style="max-width:440px;margin:0 auto">
        <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-2)">欢迎回来</h1>
        <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">你留给未来的信，还在等你开启。</p>
        <form class="cy-form" (ngSubmit)="submit()">
          <div class="cy-field">
            <label for="email">邮箱</label>
            <input class="cy-input" id="email" type="email" autocomplete="email" required [(ngModel)]="email" name="email" />
          </div>
          <div class="cy-field">
            <label for="pwd">密码</label>
            <input class="cy-input" id="pwd" type="password" autocomplete="current-password" required [(ngModel)]="password" name="password" />
            <span class="cy-field__hint">忘记密码？M1 暂不支持找回，请联系管理员重置。</span>
          </div>
          <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" style="width:100%" [disabled]="busy()">
            {{ busy() ? '登录中…' : '登录' }}
          </button>
          <div style="text-align:center;color:var(--color-text-muted);font-size:var(--font-size-sm)">
            还没有账号？<a routerLink="/register" style="color:var(--color-brand-primary)">立即注册</a>
          </div>
        </form>
      </div>
      @if (err()) {
        <div style="max-width:440px;margin:var(--space-6) auto 0">
          <app-alert variant="danger">{{ err() }}</app-alert>
        </div>
      }
    </main>
  `,
})
export class LoginComponent {
  private api = inject(ApiService);
  private auth = inject(AuthStore);
  private router = inject(Router);

  email = '';
  password = '';
  busy = signal(false);
  err = signal<string | null>(null);

  async submit() {
    this.err.set(null);
    this.busy.set(true);
    try {
      const tokens = await this.api.login({ email: this.email.trim(), password: this.password });
      this.auth.setTokens(tokens);
      const state = this.router.lastSuccessfulNavigation?.extras?.state as { from?: string } | null;
      await this.router.navigate([state?.from ?? '/me/created'], { replaceUrl: true });
    } catch (e) {
      this.err.set(e instanceof ApiError ? e.message : '登录失败');
    } finally {
      this.busy.set(false);
    }
  }
}
