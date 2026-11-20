// ============================================================
// 头像选择：时笺是十枚邮票（选中的被盖上一枚带对勾的小邮戳），琥珀是十颗小星球。
// 单选组：方向键在选项间移动。值用 [(value)]。
// ============================================================

import { ChangeDetectionStrategy, Component, computed, type ElementRef, inject, input, model, viewChild } from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { avatarOf } from '@/lib/avatars';
import { AvatarComponent } from './avatar.component';
import { PaperAvatarStampComponent } from '@/skins/paper/parts/avatar-stamp.component';
import { CONTENTS } from './host';

@Component({
  selector: 'app-avatar-picker',
  imports: [AvatarComponent, PaperAvatarStampComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div #box class="avpick" role="radiogroup" aria-label="选择头像" (keydown)="onKey($event)">
      @for (a of defs(); track a.id) {
        <button
          type="button"
          class="avpick__it"
          [class.is-sel]="a.id === value()"
          role="radio"
          [attr.aria-checked]="a.id === value()"
          [tabIndex]="a.id === value() ? 0 : -1"
          [attr.aria-label]="a.name + '，' + a.tagline"
          data-testid="avatar-option"
          [attr.data-value]="a.id"
          [attr.data-selected]="a.id === value()"
          (click)="value.set(a.id)"
        >
          @if (ui.skin() === 'paper') {
            <span appPaperAvatarStamp [avatar]="a.id"></span>
            <svg class="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true">
              <circle cx="51" cy="65" r="14.5" />
              <circle cx="51" cy="65" r="10.5" />
              <path d="M45.5 65.5l4 4 7.5-8.5" />
            </svg>
          } @else {
            <span appAvatar [avatar]="a.id" class="av--xl"></span><span>{{ a.name }}</span>
          }
        </button>
      }
    </div>
    <div class="avpick__cap">
      @if (ui.skin() === 'amber') {
        <span appAvatar [avatar]="cur().id"></span>
      }
      <b>{{ cur().name }}</b><span>{{ cur().tagline }}</span>
    </div>
  `,
})
export class AvatarPickerComponent {
  readonly value = model.required<string>();
  readonly ids = input.required<string[]>();
  protected readonly ui = inject(UiStore);
  protected readonly defs = computed(() => this.ids().map(avatarOf));
  protected readonly cur = computed(() => avatarOf(this.value()));
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  protected onKey(e: KeyboardEvent) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const ids = this.ids();
    if (!ids.length) return;
    const n = ids[(Math.max(0, ids.indexOf(this.value())) + dir + ids.length) % ids.length];
    this.value.set(n);
    requestAnimationFrame(() => this.box().nativeElement.querySelector<HTMLElement>(`[data-value="${n}"]`)?.focus());
  }
}
