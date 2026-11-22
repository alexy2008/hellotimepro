// ============================================================
// 「琥珀」创建页（/create）
// 左：表单卡（标题 · AI 代笔 · 灵感 · 正文 · 开启时间 · 发布到广场）
// 右：实时预览 + 须知
// 封存后：胶囊合拢，8 位码牌逐个翻出
// 结构与类名照 2.0 原型 amber/view-create.js；逻辑在 CreateFacade
// ============================================================

import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, type ElementRef, inject, Injector, untracked, viewChild } from '@angular/core';
import { AuthStore } from '@/stores/auth.store';
import { CreateFacade } from '@/pages/create/create.facade';
import { injectNow } from '@/core/clock';
import { reducedMotion } from '@/lib/fmt';
import { DAY } from '@/lib/schedule';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { AutofocusDirective } from '@/shared/autofocus.directive';
import { ShakeDirective } from '@/shared/shake.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { AmberBadgeComponent, AmberVisBadgeComponent } from '../parts/badge.component';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';
import { AmberSealedComponent } from './sealed.component';
import { AmberDateTimePickerComponent } from './datetime-picker.component';

const PRESETS = [
  { key: '1m', label: '1 分钟后' },
  { key: 'tm', label: '明早 9 点' },
  { key: '1w', label: '一周后' },
  { key: '1mo', label: '一个月后' },
  { key: '1y', label: '一年后' },
  { key: '5y', label: '五年后' },
  { key: '10y', label: '十年后' },
];

@Component({
  selector: 'app-amber-create',
  imports: [IconDirective, AvatarComponent, AutofocusDirective, ShakeDirective, FmtPipe, AmberBadgeComponent, AmberVisBadgeComponent, AmberCapsuleArtComponent, AmberSealedComponent, AmberDateTimePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let d = f.draft;
    @let me = auth.user()!;
    <div class="page page--create">
      <div class="container">
        @if (f.created(); as c) {
          <section appAmberSealed [c]="c" (again)="f.again()"></section>
        } @else {
          <header class="page-head">
            <div class="eyebrow">Seal a capsule</div>
            <h1 class="page-title">写一枚胶囊</h1>
            <p class="page-lead">写给未来的自己，或者某个还没出现的人。合上之后，在开启时间到来之前，没有任何人能读到它。</p>
          </header>

          <div class="create">
            <form class="create__form card" novalidate (submit)="$event.preventDefault(); f.submit()">
              <div class="field" [appShake]="f.shake().title" data-field="title">
                <div class="field__head">
                  <label class="field__label" for="title">标题 <em>*</em></label>
                  <span class="field__count mono"><b>{{ titleN() }}</b>/60</span>
                </div>
                <div class="input-wrap input-wrap--action">
                  <input
                    #titleEl
                    id="title"
                    class="input"
                    maxlength="60"
                    autocomplete="off"
                    placeholder="给这枚胶囊起个名字"
                    data-testid="create-title"
                    appAutofocus
                    [value]="d.title()"
                    (input)="f.setTitle(titleEl.value)"
                  />
                  <button
                    class="ai-btn"
                    [class.is-busy]="f.aiBusy()"
                    type="button"
                    data-testid="ai-generate"
                    title="让 AI 代写正文并建议开启时间；标题留空时会顺便起个标题"
                    (click)="f.aiWrite()"
                  ><svg appIcon="sparkle"></svg><span>{{ f.aiBusy() ? '代笔中…' : f.aiDone() ? '重新代笔' : 'AI 代笔' }}</span></button>
                </div>
                <div class="field__error" role="alert" [attr.data-testid]="f.errors().title ? 'field-error' : null" data-field="title">{{ f.errors().title }}</div>
              </div>

              <div class="recos" [class.is-hidden]="!f.showRecos()" [attr.data-testid]="f.showRecos() ? 'ai-reco' : null">
                <div class="recos__in">
                  <div class="recos__head">
                    <span><svg appIcon="sparkle"></svg>没有头绪？从一个灵感开始</span>
                    <button class="link-btn" type="button" data-testid="reco-refresh" [disabled]="f.recoBusy() || f.aiBusy()" (click)="f.refreshRecos()">
                      <svg appIcon="refresh"></svg>{{ f.recoBusy() ? '换一批中…' : '换一批' }}
                    </button>
                  </div>
                  <div class="recos__list">
                    @for (r of f.recos(); track r.title; let i = $index) {
                      <button class="reco" type="button" [style.--i]="i" data-testid="reco-chip" [disabled]="f.aiBusy()" (click)="f.aiWrite(r.title)">
                        <b>{{ r.title }}</b><span>{{ r.hint }}</span><em><svg appIcon="clock"></svg>{{ r.openInDays * day | fmt: 'span' }}后</em>
                      </button>
                    }
                  </div>
                </div>
              </div>

              <div class="field" [appShake]="f.shake().content" data-field="content">
                <div class="field__head">
                  <label class="field__label" for="content">内容 <em>*</em></label>
                  <span class="field__count mono"><b>{{ d.content().length | fmt: 'num' }}</b>/5000</span>
                </div>
                <div class="paper" [class.is-ai]="f.aiBusy()" [class.is-thinking]="f.aiThinking()">
                  <textarea
                    #contentEl
                    id="content"
                    class="paper__text"
                    maxlength="5000"
                    rows="9"
                    [placeholder]="contentPlaceholder"
                    data-testid="create-content"
                    [value]="d.content()"
                    (input)="f.setContent(contentEl.value)"
                  ></textarea>
                  <div class="paper__think" aria-hidden="true"><i></i><i></i><i></i></div>
                </div>
                <div class="field__hint">
                  @if (f.aiNote()) {
                    <span class="ai-note"><svg appIcon="sparkle"></svg>{{ f.aiNote() }}</span>
                  }
                </div>
                <div class="field__error" role="alert" [attr.data-testid]="f.errors().content ? 'field-error' : null" data-field="content">{{ f.errors().content }}</div>
              </div>

              <div class="field" [appShake]="f.shake().openAt" data-field="openAt">
                <div class="field__head">
                  <label class="field__label" for="openAt">开启时间 <em>*</em></label>
                  <span class="field__count">最早 1 分钟后 · 最晚 10 年内</span>
                </div>
                <app-amber-datetime-picker [value]="d.openAt()" (valueChange)="f.setOpenAt($event)" />
                <div class="chips">
                  @for (p of presets; track p.key) {
                    <button
                      class="chip"
                      [class.is-active]="d.preset() === p.key"
                      type="button"
                      data-testid="openat-preset"
                      [attr.data-preset]="p.key"
                      [attr.data-value]="p.key"
                      [attr.data-selected]="d.preset() === p.key"
                      (click)="f.pickPreset(p.key)"
                    >{{ p.label }}</button>
                  }
                </div>
                <div class="field__error" role="alert" [attr.data-testid]="f.errors().openAt ? 'field-error' : null" data-field="openAt">{{ f.errors().openAt }}</div>
              </div>

              <label class="toggle-card" [class.is-on]="d.inPlaza()">
                <span class="toggle-card__ic"><svg appIcon="globe"></svg></span>
                <span class="toggle-card__txt">
                  <b>发布到胶囊广场</b>
                  <small>{{ d.inPlaza() ? '标题与昵称公开展示，内容到时间才可见' : '不出现在广场；把胶囊码交给谁，谁才能找到它' }}</small>
                </span>
                <input #plazaEl type="checkbox" class="sr-only" [checked]="d.inPlaza()" data-testid="create-in-plaza" (change)="f.setInPlaza(plazaEl.checked)" />
                <span class="switch" aria-hidden="true"></span>
              </label>

              <div class="create__foot">
                <div class="create__sum">
                  <svg appIcon="hourglass"></svg>
                  @if (span() > 0) {
                    <span>将沉睡 <b>{{ span() | fmt: 'span' }}</b>，于 {{ d.openAt() | fmt: 'full' }} 开启</span>
                  } @else {
                    <span>选一个开启的时刻</span>
                  }
                </div>
                <button class="btn btn--primary btn--lg" [class.is-busy]="f.submitting()" type="submit" [disabled]="f.submitting()" data-testid="create-submit">
                  <svg appIcon="lock"></svg><span>{{ f.submitting() ? '正在封存…' : '封存胶囊' }}</span>
                </button>
              </div>
            </form>

            <aside class="create__side">
              <div class="preview card">
                <div class="preview__head"><span class="eyebrow">实时预览</span><span class="badge badge--amber">尚未封存</span></div>
                <div class="preview__art"><svg appAmberCapsuleArt [code]="null" state="opened" [width]="220"></svg></div>
                <h3 class="preview__title">{{ d.title().trim() || '未命名的胶囊' }}</h3>
                <div class="preview__by"><span appAvatar [avatar]="me.avatarId"></span>{{ me.nickname }}</div>
                <dl class="preview__table">
                  <div><dt>开启时间</dt><dd class="mono">{{ d.openAt() | fmt: 'dashTime' }}</dd></div>
                  <div><dt>沉睡时长</dt><dd>{{ span() > 0 ? (span() | fmt: 'span') : '—' }}</dd></div>
                  <div><dt>正文</dt><dd>{{ d.content().length | fmt: 'num' }} 字</dd></div>
                </dl>
                <div class="badges">
                  <span appAmberVisBadge [inPlaza]="d.inPlaza()"></span>
                  <span appAmberBadge kind="amber" icon="clock">{{ spanOrZero() | fmt: 'span' }}后</span>
                </div>
              </div>
              <ul class="notes">
                <li><svg appIcon="key"></svg><span>封存后会得到一串 8 位胶囊码，它是开启胶囊的凭证，也能分享给别人。</span></li>
                <li><svg appIcon="lock"></svg><span>到开启时间之前，内容对所有人不可见——包括写下它的你。</span></li>
                <li><svg appIcon="trash"></svg><span>封存后，内容和开启时间都不能再修改；可以在「我创建的」里删除。</span></li>
              </ul>
            </aside>
          </div>
        }
      </div>
    </div>
  `,
})
export class AmberCreateComponent {
  protected readonly f = inject(CreateFacade);
  protected readonly auth = inject(AuthStore);
  protected readonly now = injectNow();
  protected readonly presets = PRESETS;
  protected readonly day = DAY;
  protected readonly contentPlaceholder = '在这里写下想交给未来的话。\n可以是此刻的天气、正在读的书、一个小小的约定，\n或者只是一句：嘿，你还好吗？';
  protected readonly span = computed(() => this.f.draft.openAt() - this.now());
  protected readonly spanOrZero = computed(() => Math.max(this.span(), 0));
  protected readonly titleN = computed(() => Array.from(this.f.draft.title()).length);

  private readonly titleEl = viewChild<ElementRef<HTMLInputElement>>('titleEl');
  private readonly contentEl = viewChild<ElementRef<HTMLTextAreaElement>>('contentEl');
  private readonly injector = inject(Injector);

  constructor() {
    // 正文框随内容长高
    effect(() => {
      this.f.draft.content();
      afterNextRender(() => this.grow(), { injector: this.injector });
    });
    // 校验失败：把出错的字段滚到眼前
    let first = true;
    effect(() => {
      this.f.shake();
      if (first) return void (first = false);
      untracked(() =>
        afterNextRender(
          () => {
            document.querySelector('.field.is-shake')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
            const e = this.f.errors();
            if (e.title) this.titleEl()?.nativeElement.focus({ preventScroll: true });
            else if (e.content) this.contentEl()?.nativeElement.focus({ preventScroll: true });
          },
          { injector: this.injector },
        ),
      );
    });
  }

  private grow() {
    const el = this.contentEl()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 36 * 8) + 'px';
  }
}
