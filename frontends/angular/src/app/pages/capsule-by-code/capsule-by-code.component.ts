import { Component, inject, Input, OnChanges, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { ApiError, type CapsuleDetail } from '@/types';
import { CapsuleDetailComponent } from '@/components/capsule-detail/capsule-detail.component';
import { AlertComponent } from '@/components/alert/alert.component';

@Component({
  selector: 'app-capsule-by-code',
  standalone: true,
  imports: [RouterLink, CapsuleDetailComponent, AlertComponent],
  template: `
    <main class="cy-container">
      @if (loading()) {
        <div class="cy-empty"><p>加载中…</p></div>
      } @else if (cap()) {
        <app-capsule-detail [capsule]="cap()!"
          (onChange)="cap.set($event)"
          (onExpired)="reload()" />
      } @else {
        <div style="max-width:560px;margin:var(--space-12) auto">
          <app-alert variant="danger">{{ err() ?? '胶囊不存在' }}</app-alert>
          <div style="margin-top:var(--space-4);text-align:center">
            <a routerLink="/open" class="cy-btn cy-btn--ghost">返回输入码</a>
          </div>
        </div>
      }
    </main>
  `,
})
export class CapsuleByCodeComponent implements OnChanges {
  @Input() code = '';
  private api = inject(ApiService);

  cap = signal<CapsuleDetail | null>(null);
  err = signal<string | null>(null);
  loading = signal(true);

  ngOnChanges() { void this.load(); }

  private async load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.err.set(null);
    try {
      const c = await this.api.capsuleByCode(this.code.toUpperCase());
      this.cap.set(c);
    } catch (e) {
      this.err.set(e instanceof ApiError ? e.message : '胶囊不存在');
    } finally {
      if (showLoading) this.loading.set(false);
    }
  }

  reload() { void this.load(false); }
}
