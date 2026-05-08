import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { ApiError } from '@/types';
import { CapsuleCodeInputComponent } from '@/components/capsule-code-input/capsule-code-input.component';
import { AlertComponent } from '@/components/alert/alert.component';

@Component({
  selector: 'app-open',
  standalone: true,
  imports: [CapsuleCodeInputComponent, AlertComponent],
  template: `
    <main class="cy-container">
      <div class="cy-open-center">
        <h1>用 8 位密钥开启胶囊</h1>
        <p>输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。</p>
        <div style="margin-bottom:var(--space-8)">
          <app-capsule-code-input [value]="code()" (onChange)="code.set($event)" (onComplete)="open($event)" />
        </div>
        <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap">
          <button class="cy-btn cy-btn--primary cy-btn--lg"
            [disabled]="busy() || code().length !== 8" (click)="open(code())">
            {{ busy() ? '查询中…' : '开启 →' }}
          </button>
          <button class="cy-btn cy-btn--ghost cy-btn--lg" (click)="paste()">粘贴识别</button>
        </div>
        <div style="margin-top:var(--space-10);color:var(--color-text-muted);font-size:var(--font-size-sm)">
          <div style="display:flex;gap:var(--space-4);justify-content:center;flex-wrap:wrap">
            <span>💡 可用 <code style="background:var(--color-surface-2);padding:2px 6px;border-radius:var(--radius-sm)">/c/&lt;code&gt;</code> 直链访问</span>
            <span>🔒 未到开启时间的胶囊也会显示倒计时</span>
          </div>
        </div>
      </div>
      @if (err()) {
        <div style="max-width:560px;margin:0 auto">
          <app-alert variant="danger">{{ err() }}</app-alert>
        </div>
      }
    </main>
  `,
})
export class OpenComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  code = signal('');
  err = signal<string | null>(null);
  busy = signal(false);

  async open(c: string) {
    if (c.length !== 8) return;
    this.err.set(null);
    this.busy.set(true);
    try {
      const cap = await this.api.capsuleByCode(c);
      await this.router.navigate(['/c', cap.code]);
    } catch (e) {
      this.err.set(e instanceof ApiError ? e.message : '找不到这条胶囊');
    } finally {
      this.busy.set(false);
    }
  }

  async paste() {
    try {
      const text = await navigator.clipboard.readText();
      const filtered = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      this.code.set(filtered);
      if (filtered.length === 8) void this.open(filtered);
    } catch {
      this.err.set('粘贴失败：请允许浏览器访问剪贴板');
    }
  }
}
