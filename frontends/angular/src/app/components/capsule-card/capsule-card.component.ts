import {
  Component, input, OnDestroy, OnInit, output, signal, TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoriteButtonComponent } from '@/components/favorite-button/favorite-button.component';
import { avatarUrl } from '@/utils/avatar';
import { countdownTo, fmtNumber } from '@/utils/format';
import type { CapsuleListItem } from '@/types';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-capsule-card',
  standalone: true,
  imports: [RouterLink, FavoriteButtonComponent, NgTemplateOutlet],
  template: `
    <article [class]="'cy-capsule ' + (capsule().isOpened ? 'cy-capsule--opened' : 'cy-capsule--sealed')">
      <div class="cy-capsule__head">
        <span [class]="'cy-badge ' + (capsule().isOpened ? 'cy-badge--opened' : 'cy-badge--sealed')">
          {{ capsule().isOpened ? '已开启' : '未开启' }}
        </span>
        <a [routerLink]="['/c', capsule().code]" class="cy-capsule__code" style="text-decoration:none">
          {{ capsule().code }}
        </a>
      </div>

      <a [routerLink]="['/c', capsule().code]" style="text-decoration:none;color:inherit">
        <h3 class="cy-capsule__title">{{ capsule().title }}</h3>
      </a>

      @if (!capsule().isOpened) {
        <p class="cy-capsule__countdown">
          ⏳ 还剩 {{ fmtNumber(cd().days) }} 天 · {{ pad(cd().hours) }}:{{ pad(cd().minutes) }}:{{ pad(cd().seconds) }}
        </p>
      }
      @if (capsule().isOpened && capsule().contentPreview) {
        <p class="cy-capsule__preview">{{ capsule().contentPreview }}</p>
      }

      <div class="cy-capsule__meta">
        @if (showCreator()) {
          <span class="cy-capsule__creator">
            <img [src]="avatarUrl(capsule().creator.avatarId)" alt="" />
            {{ capsule().creator.nickname }}
          </span>
        } @else {
          <span style="color:var(--color-text-muted)">
            创建于 {{ fmtDate(capsule().createdAt) }}
          </span>
        }
        @if (rightTemplate()) {
          <ng-template [ngTemplateOutlet]="rightTemplate()!" [ngTemplateOutletContext]="{ $implicit: capsule() }" />
        } @else if (!hideFavorite()) {
          <app-favorite-button [capsule]="capsule()" />
        }
      </div>
    </article>
  `,
})
export class CapsuleCardComponent implements OnInit, OnDestroy {
  capsule = input.required<CapsuleListItem>();
  showCreator = input(true);
  hideFavorite = input(false);
  rightTemplate = input<TemplateRef<unknown> | null>(null);
  avatarUrl = avatarUrl;
  fmtNumber = fmtNumber;

  cd = signal(countdownTo(''));
  private ticker: ReturnType<typeof setInterval> | null = null;

  fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('zh-CN');
  }

  pad(n: number) { return String(n).padStart(2, '0'); }

  ngOnInit() {
    this.cd.set(countdownTo(this.capsule().openAt));
    if (!this.capsule().isOpened) {
      this.ticker = setInterval(() => {
        this.cd.set(countdownTo(this.capsule().openAt));
      }, 1000);
    }
  }

  ngOnDestroy() {
    if (this.ticker) clearInterval(this.ticker);
  }
}
