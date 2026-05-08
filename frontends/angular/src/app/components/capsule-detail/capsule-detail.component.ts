import {
  Component, input, OnChanges, OnDestroy, OnInit, output, signal, SimpleChanges,
} from '@angular/core';
import { FavoriteButtonComponent } from '@/components/favorite-button/favorite-button.component';
import { avatarUrl } from '@/utils/avatar';
import { countdownTo, fmtDateTime } from '@/utils/format';
import type { CapsuleDetail } from '@/types';

interface CalUnit { value: number; label: string }

@Component({
  selector: 'app-capsule-detail',
  standalone: true,
  imports: [FavoriteButtonComponent],
  template: `
    <div class="cy-capsule-detail">
      <div class="cy-capsule-detail__head">
        <span [class]="'cy-badge ' + (capsule().isOpened ? 'cy-badge--opened' : 'cy-badge--sealed')">
          {{ capsule().isOpened ? '已开启' : '未开启' }}
        </span>
        @if (capsule().inPlaza) {
          <span class="cy-badge cy-badge--plaza">广场公开</span>
        }
        <span class="cy-capsule__code">{{ capsule().code }}</span>
        <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">
          · 创建于 {{ fmtDateTime(capsule().createdAt) }}
        </span>
      </div>

      <h1 class="cy-capsule-detail__title">{{ capsule().title }}</h1>

      @if (capsule().isOpened && capsule().content !== null) {
        <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-4);font-size:var(--font-size-sm);color:var(--color-text-muted)">
          <span>🔓</span>
          <span>开启于 <strong style="color:var(--color-capsule-opened-accent)">{{ fmtDateTime(capsule().openAt) }}</strong></span>
        </div>
        <div class="cy-capsule-detail__content">{{ capsule().content }}</div>
      } @else {
        <div class="cy-capsule-detail__sealed">
          <div style="font-size:var(--font-size-4xl);opacity:0.7">🔒</div>
          <div style="color:var(--color-text-secondary);margin-top:var(--space-3);font-size:var(--font-size-sm);letter-spacing:0.1em">
            这封信还在上锁，将在以下时刻开启
          </div>
          <div class="cy-cal">
            @for (unit of calUnits(); track unit.label) {
              <div class="cy-cal-unit">
                <div class="cy-cal-card"><div class="cy-cal-num">{{ pad(unit.value) }}</div><div class="cy-cal-crease"></div></div>
                <div class="cy-cal-label">{{ unit.label }}</div>
              </div>
              @if (!$last) { <span class="cy-cal-sep">:</span> }
            }
          </div>
          <div style="color:var(--color-text-secondary)">
            @if (cd().expired) {
              {{ autoOpening() ? '正在开启…' : '正在同步开启状态…' }}
            } @else {
              开启于 <strong style="color:var(--color-text-primary)">{{ fmtDateTime(capsule().openAt) }}</strong>
            }
          </div>
        </div>
      }

      <div style="margin-top:var(--space-6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3)">
        <div style="display:flex;align-items:center;gap:var(--space-2);color:var(--color-text-secondary);font-size:var(--font-size-sm)">
          来自
          <img [src]="avatarUrl(capsule().creator.avatarId)" alt="" style="width:32px;height:32px;border-radius:50%" />
          <strong style="color:var(--color-text-primary)">{{ capsule().creator.nickname }}</strong>
        </div>
        <div style="display:flex;gap:var(--space-3)">
          <button type="button" class="cy-btn cy-btn--ghost" (click)="copyCode()">📎 复制 8 位码</button>
          <button type="button" class="cy-btn cy-btn--ghost" (click)="copyLink()">🔗 分享链接</button>
          <app-favorite-button [capsule]="capsule()" size="md"
            (onChange)="onFavChange($event)" />
        </div>
      </div>

      @if (!capsule().isOpened) {
        <div class="cy-alert cy-alert--info" style="margin-top:var(--space-6)">
          <span>ⓘ</span>
          <span>未开启的胶囊仅显示标题与倒计时，内容将在开启后公开到广场。</span>
        </div>
      }
      @if (capsule().isOpened && capsule().inPlaza) {
        <div class="cy-alert cy-alert--success" style="margin-top:var(--space-6)">
          <span>✓</span>
          <span>这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。</span>
        </div>
      }
    </div>
  `,
})
export class CapsuleDetailComponent implements OnInit, OnChanges, OnDestroy {
  capsule = input.required<CapsuleDetail>();
  onChange = output<CapsuleDetail>();
  onExpired = output<void>();

  avatarUrl = avatarUrl;
  fmtDateTime = fmtDateTime;

  cd = signal(countdownTo(''));
  autoOpening = signal(false);
  calUnits = signal<CalUnit[]>([]);

  private ticker: ReturnType<typeof setInterval> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() { this.startTimers(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['capsule']) {
      this.stopTimers();
      this.startTimers();
    }
  }

  ngOnDestroy() { this.stopTimers(); }

  private startTimers() {
    if (this.capsule().isOpened) return;
    this.updateCd();
    this.ticker = setInterval(() => this.updateCd(), 1000);

    const openAt = new Date(this.capsule().openAt).getTime();
    if (!Number.isNaN(openAt)) {
      const delay = Math.max(0, openAt - Date.now() + 250);
      this.expiryTimer = setTimeout(() => this.tryAutoOpen(), delay);
    }
  }

  private stopTimers() {
    if (this.ticker) clearInterval(this.ticker);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.ticker = null;
    this.expiryTimer = null;
  }

  private updateCd() {
    const c = countdownTo(this.capsule().openAt);
    this.cd.set(c);
    this.calUnits.set([
      { value: c.days, label: '天' },
      { value: c.hours, label: '时' },
      { value: c.minutes, label: '分' },
      { value: c.seconds, label: '秒' },
    ]);
  }

  private async tryAutoOpen() {
    if (this.capsule().isOpened) return;
    this.autoOpening.set(true);
    try {
      this.onExpired.emit();
    } finally {
      this.autoOpening.set(false);
      if (!this.capsule().isOpened) {
        this.expiryTimer = setTimeout(() => this.tryAutoOpen(), 1000);
      }
    }
  }

  pad(n: number) { return String(n).padStart(2, '0'); }

  copyCode() { void navigator.clipboard.writeText(this.capsule().code); }
  copyLink() { void navigator.clipboard.writeText(window.location.href); }

  onFavChange(e: { favorited: boolean; count: number }) {
    this.onChange.emit({
      ...this.capsule(),
      favoritedByMe: e.favorited,
      favoriteCount: e.count,
    });
  }
}
