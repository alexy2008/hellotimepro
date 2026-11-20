// ============================================================
// 胶囊详情的页面逻辑（/capsules/:code）：取数、逐秒倒数、到点后等服务端确认开启。
// 未开启时逐秒倒数，归零那一刻 expired 变 true——皮肤据此播放开启动画，
// 并调用 awaitOpened() 拿到正文（不用刷新页面）。
// ============================================================

import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { injectNow } from '@/core/clock';
import { ApiError, type CapsuleDetail } from '@/types';
import { ms, sleep } from '@/lib/fmt';

export type DetailStatus = 'loading' | 'ok' | 'missing' | 'error';

@Injectable()
export class CapsuleFacade {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly title = inject(Title);

  readonly code = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('code') ?? '')), { initialValue: '' });
  readonly capsule = signal<CapsuleDetail | null>(null);
  readonly status = signal<DetailStatus>('loading');
  readonly now = injectNow();
  readonly expired = computed(() => {
    const c = this.capsule();
    return !!c && !c.isOpened && ms(c.openAt) <= this.now();
  });

  /** 换了码或离开页面就加一，作废进行中的等待 */
  private gen = 0;
  /** 取数序列号：只认最后一次 */
  private loadSeq = 0;

  constructor() {
    let lastCode: string | undefined;
    // 换了码重新取；登录态变了，favoritedByMe 也会变
    effect(() => {
      const code = this.code();
      this.auth.user()?.id;
      untracked(() => {
        if (code !== lastCode) {
          lastCode = code;
          this.gen++;
          this.status.set('loading');
          this.capsule.set(null);
        }
        void this.load();
      });
    });
    effect(() => {
      const c = this.capsule();
      if (c) this.title.setTitle(`${c.title} · HelloTime Pro`);
    });
    inject(DestroyRef).onDestroy(() => this.gen++);
  }

  private async load() {
    const my = ++this.loadSeq;
    const g = this.gen;
    const stale = () => my !== this.loadSeq || g !== this.gen;
    try {
      const d = await this.api.capsuleByCode(this.code());
      if (stale()) return;
      this.capsule.set(d);
      this.status.set('ok');
    } catch (e) {
      if (!stale()) this.status.set(e instanceof ApiError && e.status === 404 ? 'missing' : 'error');
    }
  }

  /**
   * 倒数归零后取正文：以服务端的 isOpened 为准。本机时钟可能比服务端快几秒，
   * 这时接口仍返回未开启——隔一会儿再问（1s、2s…最多 5s 一次），直到真正开启；
   * 离开页面、换了码或胶囊已被删除（404）时返回 null
   */
  async awaitOpened(): Promise<CapsuleDetail | null> {
    const my = this.gen;
    for (let i = 0; my === this.gen; i++) {
      try {
        const d = await this.api.capsuleByCode(this.code());
        if (my !== this.gen) return null;
        if (d.isOpened) {
          this.capsule.set(d);
          return d;
        }
      } catch (e) {
        if (my !== this.gen) return null;
        if (e instanceof ApiError && e.status === 404) {
          this.status.set('missing');
          return null;
        }
      }
      await sleep(Math.min(1000 * (i + 1), 5000));
    }
    return null;
  }
}

/** 正文按空行分段，每段再按单个换行拆成行 */
export const paragraphs = (text: string | null | undefined) =>
  String(text ?? '')
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => p.split('\n'));
