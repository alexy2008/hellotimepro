// ============================================================
// 「时笺」创建页（/create）
// 左：一张红格信笺（标题 · AI 灵感 · 正文）
// 右：封缄台（时间标尺 + 日历 · 是否公开 · 信封预览 · 长按封缄）
// 完成后：封缄仪式 → 取信凭证（8 位胶囊码）
// 结构与类名照 2.0 原型 paper/view-create.js；逻辑在 CreateFacade
// ============================================================

import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, type ElementRef, inject, Injector, signal, untracked, viewChild } from '@angular/core';
import { AuthStore } from '@/stores/auth.store';
import { CreateFacade } from '@/pages/create/create.facade';
import { injectNow } from '@/core/clock';
import { clamp, focusIfIdle, reducedMotion } from '@/lib/fmt';
import { DAY, LIMITS } from '@/lib/schedule';
import { IconDirective } from '@/shared/icon.directive';
import { AvatarComponent } from '@/shared/avatar.component';
import { AutofocusDirective } from '@/shared/autofocus.directive';
import { ShakeDirective } from '@/shared/shake.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { PaperAvatarStampComponent } from '../parts/avatar-stamp.component';
import { PaperPostmarkComponent } from '../parts/postmark.component';
import { PaperCalendarComponent } from './calendar.component';
import { PaperCeremonyComponent } from './ceremony.component';
import { PaperHoldSealComponent } from './hold-seal.component';
import { PaperTimeRulerComponent } from './time-ruler.component';

const PRESETS = [
  { key: '1m', label: '1 分钟后', sub: '体验启封' },
  { key: 'tm', label: '明早 9 点' },
  { key: '1mo', label: '1 个月后' },
  { key: '1y', label: '1 年后' },
  { key: '5y', label: '5 年后' },
  { key: '10y', label: '10 年后' },
];

@Component({
  selector: 'app-paper-create',
  imports: [
    IconDirective,
    AvatarComponent,
    AutofocusDirective,
    ShakeDirective,
    FmtPipe,
    PaperAvatarStampComponent,
    PaperPostmarkComponent,
    PaperCalendarComponent,
    PaperCeremonyComponent,
    PaperHoldSealComponent,
    PaperTimeRulerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let d = f.draft;
    @let me = auth.user()!;
    <div class="page page--create">
      <div class="wrap create">
        <header class="pagehead">
          <div>
            <div class="overline"><i></i>New capsule</div>
            <h1 class="h1">写给未来的信</h1>
          </div>
          <p class="lede">这段文字会被封存，直到你设定的时刻，<br />才能被任何人——包括你自己——打开。</p>
        </header>

        <div class="create__grid">
          <!-- ============ 信笺 ============ -->
          <section class="sheet" [class.is-ai]="f.aiBusy()" [class.is-thinking]="f.aiThinking()" aria-label="信的内容">
            <div class="sheet__head">
              <span class="sheet__to">致 未来 ——</span>
              <button
                class="aibtn"
                [class.is-busy]="f.aiBusy()"
                type="button"
                data-testid="ai-generate"
                title="让 AI 代写正文并建议启封时间；标题留空时会顺便起个标题"
                (click)="f.aiWrite()"
              ><svg appIcon="sparkle"></svg><span>{{ f.aiBusy() ? '代笔中…' : f.aiDone() ? '重新代笔' : 'AI 代笔' }}</span></button>
            </div>

            <div class="sheet__title" [appShake]="f.shake().title">
              <input
                #titleEl
                [appAutofocus]="420"
                type="text"
                maxlength="60"
                autocomplete="off"
                placeholder="给这封信起个标题"
                aria-label="标题，最多 60 字"
                data-testid="create-title"
                [value]="d.title()"
                (input)="f.setTitle(titleEl.value)"
              />
              <span class="sheet__n mono"><b>{{ titleN() }}</b>/60</span>
            </div>
            <div class="sheet__err" role="alert" [attr.data-testid]="f.errors().title ? 'field-error' : null" data-field="title">{{ f.errors().title }}</div>

            <div class="recos" [class.is-hidden]="!f.showRecos()" [attr.data-testid]="f.showRecos() ? 'ai-reco' : null">
              <div class="recos__in">
                <div class="recos__head">
                  <span><svg appIcon="sparkle"></svg>没有头绪？从一个灵感开始</span>
                  <button class="linkbtn" type="button" data-testid="reco-refresh" [disabled]="f.recoBusy() || f.aiBusy()" (click)="f.refreshRecos()">
                    <svg appIcon="refresh"></svg>{{ f.recoBusy() ? '换一批中…' : '换一批' }}
                  </button>
                </div>
                <div class="recos__list">
                  @for (r of f.recos(); track r.title; let i = $index) {
                    <button class="reco" type="button" [style.--i]="i" data-testid="reco-chip" [disabled]="f.aiBusy()" (click)="f.aiWrite(r.title)">
                      <b>{{ r.title }}</b><span>{{ r.hint }}</span><em>{{ r.openInDays * day | fmt: 'span' }}后</em>
                    </button>
                  }
                </div>
              </div>
            </div>

            <div class="sheet__body" [appShake]="f.shake().content">
              <textarea
                #contentEl
                maxlength="5000"
                rows="9"
                aria-label="正文，最多 5000 字"
                [placeholder]="contentPlaceholder"
                data-testid="create-content"
                [value]="d.content()"
                (input)="f.setContent(contentEl.value)"
              ></textarea>
              <div class="sheet__think" aria-hidden="true"><i></i><i></i><i></i></div>
            </div>
            <div class="sheet__err" role="alert" [attr.data-testid]="f.errors().content ? 'field-error' : null" data-field="content">{{ f.errors().content }}</div>

            <div class="sheet__foot">
              <span class="sheet__ainote">
                @if (f.aiNote()) {
                  <svg appIcon="sparkle"></svg>{{ f.aiNote() }}
                }
              </span>
              <span class="sheet__n mono"><b>{{ d.content().length | fmt: 'num' }}</b> / 5000</span>
            </div>

            <div class="sheet__sign">
              <span>——</span><span appAvatar [avatar]="me.avatarId"></span><b>{{ me.nickname }}</b>
              <span class="sheet__date">{{ now() | fmt: 'cn' }} {{ now() | fmt: 'week' }}</span>
            </div>
          </section>

          <!-- ============ 封缄台 ============ -->
          <aside class="desk" aria-label="封缄设置">
            <section class="panel" [appShake]="f.shake().openAt">
              <h2 class="panel__h"><span class="panel__no">壹</span>启封时刻</h2>

              <div class="presets">
                @for (p of presets; track p.key) {
                  <button
                    class="chip"
                    [class.is-active]="d.preset() === p.key"
                    type="button"
                    data-testid="openat-preset"
                    [attr.data-value]="p.key"
                    [attr.data-selected]="d.preset() === p.key"
                    (click)="f.pickPreset(p.key)"
                  >
                    {{ p.label }}
                    @if (p.sub) {
                      <small>{{ p.sub }}</small>
                    }
                  </button>
                }
              </div>

              <div appPaperTimeRuler [openAt]="d.openAt()" [now]="now()" (pick)="f.setOpenAt($event)"></div>

              <div class="when">
                <div class="when__rel serif">{{ span() | fmt: 'span' }}后</div>
                <div class="when__abs" data-testid="create-openat" [attr.data-value]="iso()">{{ d.openAt() | fmt: 'full' }}</div>
                <button class="linkbtn when__more" [class.is-open]="calOpen()" type="button" [attr.aria-expanded]="calOpen()" (click)="calOpen.set(!calOpen())">
                  <svg appIcon="calendar"></svg><span>精确到分钟</span><svg appIcon="chev-down" class="ic--chev"></svg>
                </button>
              </div>
              <div class="sheet__err" role="alert" [attr.data-testid]="f.errors().openAt ? 'field-error' : null" data-field="openAt">{{ f.errors().openAt }}</div>

              <div class="calwrap" [class.is-open]="calOpen()">
                <div class="calwrap__in">
                  @if (calOpen()) {
                    <div appPaperCalendar [openAt]="d.openAt()" (pick)="pickExact($event)"></div>
                  }
                </div>
              </div>
            </section>

            <section class="panel">
              <h2 class="panel__h"><span class="panel__no">贰</span>寄往广场</h2>
              <label class="switch">
                <input #plazaEl type="checkbox" [checked]="d.inPlaza()" data-testid="create-in-plaza" (change)="f.setInPlaza(plazaEl.checked)" />
                <span class="switch__track"><i></i></span>
                <span class="switch__text">
                  <b>{{ d.inPlaza() ? '发布到胶囊广场' : '只凭胶囊码可见' }}</b>
                  <small>{{ d.inPlaza() ? '所有人能看到标题与倒计时；正文在启封后公开。' : '不会出现在广场；把 8 位胶囊码交给谁，谁才能找到它。' }}</small>
                </span>
              </label>
            </section>

            <section class="panel panel--seal">
              <h2 class="panel__h"><span class="panel__no">叁</span>封缄</h2>
              <div class="envf" [class.is-private]="!d.inPlaza()" aria-hidden="true">
                <div class="envf__stamp"><span appPaperAvatarStamp [avatar]="me.avatarId" class="stamp--sm" [label]="false"></span></div>
                <div class="envf__pm">
                  <svg appPaperPostmark [line1]="d.openAt() | fmt: 'date'" [line2]="(d.openAt() | fmt: 'time') + ' 启'" class="pm--envf"></svg>
                </div>
                <div class="envf__to"><small>寄往</small><b>{{ d.openAt() | fmt: 'cn' }}</b><span>{{ span() | fmt: 'span' }}后的未来</span></div>
                <div class="envf__title serif">{{ d.title().trim() ? '《' + d.title().trim() + '》' : '《未命名的信》' }}</div>
                <div class="envf__from mono">
                  <span>自 {{ now() | fmt: 'date' }} · {{ me.nickname }}</span><span>{{ d.inPlaza() ? '广场公开' : '仅凭码可见' }}</span>
                </div>
              </div>

              <app-paper-hold-seal />
            </section>
          </aside>
        </div>
      </div>
      @if (f.created(); as c) {
        <div appPaperCeremony [c]="c" (again)="onAgain()"></div>
      }
    </div>
  `,
})
export class PaperCreateComponent {
  protected readonly f = inject(CreateFacade);
  protected readonly auth = inject(AuthStore);
  protected readonly now = injectNow();
  protected readonly presets = PRESETS;
  protected readonly day = DAY;
  protected readonly calOpen = signal(false);
  protected readonly contentPlaceholder = '在这里写下想传到未来的话。\n可以是此刻的天气、正在读的书、一个小小的许诺，\n或者只是一句：嘿，你还好吗？';
  protected readonly span = computed(() => this.f.draft.openAt() - this.now());
  protected readonly iso = computed(() => new Date(this.f.draft.openAt()).toISOString());
  protected readonly titleN = computed(() => Array.from(this.f.draft.title()).length);

  private readonly titleEl = viewChild.required<ElementRef<HTMLInputElement>>('titleEl');
  private readonly contentEl = viewChild.required<ElementRef<HTMLTextAreaElement>>('contentEl');
  private readonly holdSeal = viewChild.required(PaperHoldSealComponent);
  private readonly injector = inject(Injector);

  constructor() {
    // 正文框随内容长高
    effect(() => {
      this.f.draft.content();
      afterNextRender(() => this.grow(), { injector: this.injector });
    });
    // 校验失败：把出错的字段滚到眼前并聚焦
    let first = true;
    effect(() => {
      const s = this.f.shake();
      if (first) return void (first = false);
      untracked(() => {
        const e = this.f.errors();
        const el = e.title ? this.titleEl().nativeElement : e.content ? this.contentEl().nativeElement : null;
        if (!el || !(s.title || s.content)) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      });
    });
  }

  private grow() {
    const el = this.contentEl().nativeElement;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 34 * 9) + 'px';
  }

  protected pickExact(t: number) {
    this.f.setOpenAt(clamp(t, LIMITS.minOpen() + 30_000, LIMITS.maxOpen()));
  }

  protected onAgain() {
    this.f.again();
    this.holdSeal().reset();
    focusIfIdle(this.titleEl().nativeElement);
    this.titleEl().nativeElement.focus({ preventScroll: true });
  }
}
