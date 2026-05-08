import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { ApiError } from '@/types';
import { AlertComponent } from '@/components/alert/alert.component';
import { isoToLocalInput, localInputToIso } from '@/utils/format';

function presetTime(spec: '1m' | '1h' | 'tomorrow9' | '1y' | 'y2030'): string {
  const now = new Date();
  switch (spec) {
    case '1m': now.setSeconds(now.getSeconds() + 130); break;
    case '1h': now.setHours(now.getHours() + 1); break;
    case 'tomorrow9': now.setDate(now.getDate() + 1); now.setHours(9, 0, 0, 0); break;
    case '1y': now.setFullYear(now.getFullYear() + 1); break;
    case 'y2030': return '2030-01-01T00:00';
  }
  return isoToLocalInput(now.toISOString());
}

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [FormsModule, AlertComponent],
  template: `
    <main class="cy-container cy-container--narrow"
      style="margin-top:var(--space-10);margin-bottom:var(--space-16)">
      <div style="max-width:720px;margin:0 auto">
        <h1 style="font-family:var(--font-display);font-size:var(--font-size-4xl);margin:0 0 var(--space-2)">写给未来的信</h1>
        <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">
          这段文字会被上锁，直到你设定的时刻才能由任何人 —— 包括你自己 —— 开启。
        </p>
        <form class="cy-form" (ngSubmit)="submit()">
          <div class="cy-field">
            <label for="title">标题 <span style="color:var(--color-text-muted);font-weight:400">· 最多 60 字</span></label>
            <input class="cy-input" id="title" type="text" maxlength="60" required [(ngModel)]="title" name="title" />
          </div>
          <div class="cy-field">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-1)">
              <label for="content" style="margin:0">内容 <span style="color:var(--color-text-muted);font-weight:400">· 最多 5000 字</span></label>
              <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm"
                [disabled]="aiLoading()" (click)="aiGenerate()">
                {{ aiLoading() ? '生成中…' : '✨ AI 生成' }}
              </button>
            </div>
            <textarea class="cy-textarea" id="content" rows="10" maxlength="5000" required
              [(ngModel)]="content" name="content"
              placeholder="在这里写下你想传递到未来的话。建议：&#10;- 具体的场景 / 情绪 / 正在读的书&#10;- 一个小小的许诺&#10;- 或只是一句：嘿，还活着吗？"></textarea>
            <span class="cy-field__hint">
              <span style="color:var(--color-text-secondary)">{{ content.length }}</span> / 5000
            </span>
          </div>
          <div class="cy-field">
            <label for="open_at">开启时间 <span style="color:var(--color-text-muted);font-weight:400">· 最早 60 秒后</span></label>
            <input class="cy-input" id="open_at" type="datetime-local" required [(ngModel)]="openLocal" name="openLocal" />
            <span class="cy-field__hint">时区以你当前所在时区为准，提交时会转换为 UTC。</span>
          </div>
          <div class="cy-field">
            <label>可见性</label>
            <label class="cy-toggle">
              <input type="checkbox" [(ngModel)]="inPlaza" name="inPlaza" />
              <span class="cy-toggle__track"></span>
              <span class="cy-toggle__body">
                <span class="cy-toggle__label">发布到胶囊广场</span>
                <span class="cy-toggle__hint">开启后，胶囊标题和倒计时将对所有人可见；关闭后仅持有胶囊码的人可访问。</span>
              </span>
            </label>
          </div>
          <div class="cy-field">
            <label>快速预设</label>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
              @for (p of presets; track p.spec) {
                <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" (click)="setPreset(p.spec)">{{ p.label }}</button>
              }
            </div>
          </div>
          <app-alert variant="info">上锁后不可编辑、不可提前开启；可以在"我创建的"列表里随时撤回（删除）。</app-alert>
          @if (err()) { <app-alert variant="danger">{{ err() }}</app-alert> }
          <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
            <button type="button" class="cy-btn cy-btn--ghost" (click)="router.navigate(['/'])">取消</button>
            <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" [disabled]="busy()">
              {{ busy() ? '封存中…' : '🔒 上锁封存' }}
            </button>
          </div>
        </form>
      </div>
    </main>
  `,
})
export class CreateComponent {
  private api = inject(ApiService);
  router = inject(Router);

  title = '';
  content = '';
  openLocal = presetTime('1h');
  inPlaza = true;
  busy = signal(false);
  aiLoading = signal(false);
  err = signal<string | null>(null);

  presets = [
    { spec: '1m' as const, label: '1 分钟后（测试）' },
    { spec: '1h' as const, label: '1 小时后' },
    { spec: 'tomorrow9' as const, label: '明天早上 9:00' },
    { spec: '1y' as const, label: '1 年后' },
    { spec: 'y2030' as const, label: '2030.01.01' },
  ];

  setPreset(spec: '1m' | '1h' | 'tomorrow9' | '1y' | 'y2030') {
    this.openLocal = presetTime(spec);
  }

  async aiGenerate() {
    if (!this.title.trim()) {
      this.err.set('请先填写标题，AI 将据此生成内容');
      return;
    }
    this.err.set(null);
    this.aiLoading.set(true);
    try {
      const s = await this.api.suggestCapsule({ title: this.title.trim() });
      this.content = s.content;
      const d = new Date();
      d.setDate(d.getDate() + s.openInDays);
      d.setHours(9, 0, 0, 0);
      this.openLocal = isoToLocalInput(d.toISOString());
    } catch (e) {
      this.err.set(e instanceof ApiError ? e.message : 'AI 生成失败，请稍后重试');
    } finally {
      this.aiLoading.set(false);
    }
  }

  async submit() {
    this.err.set(null);
    this.busy.set(true);
    try {
      const created = await this.api.createCapsule({
        title: this.title.trim(),
        content: this.content,
        openAt: localInputToIso(this.openLocal),
        inPlaza: this.inPlaza,
      });
      await this.router.navigate(['/c', created.code], { replaceUrl: true });
    } catch (e) {
      this.err.set(e instanceof ApiError ? e.message : '创建失败');
    } finally {
      this.busy.set(false);
    }
  }
}
