// 当前后端的 /health：页脚与关于页共用，整个应用只请求一次（失败了下次再试）
import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '@/api/api.service';
import type { HealthData } from '@/types';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly api = inject(ApiService);
  private pending: Promise<void> | null = null;

  readonly health = signal<HealthData | null>(null);
  /** null = 连接中 */
  readonly online = signal<boolean | null>(null);
  readonly backend = computed(() => this.health()?.stack.items ?? []);
  /** 后端的名字：优先取「框架」那一项 */
  readonly backendName = computed((): string | undefined => this.backend().find((i) => i.role === 'framework')?.name ?? this.backend()[0]?.name);

  /** 页脚、关于页创建时调用；已经拿到或正在拿就不再发请求 */
  load(): void {
    if (this.health() || this.pending) return;
    this.pending = this.api
      .health()
      .then((h) => {
        this.health.set(h);
        this.online.set(true);
      })
      .catch(() => this.online.set(false))
      .finally(() => (this.pending = null));
  }
}
