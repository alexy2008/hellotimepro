// ============================================================
// 「琥珀」8 格输码：8 个展示格 + 一个盖在上面的透明原生输入框
// （键盘、粘贴、输入法都交给它）。size：'md' 首页 / 'lg' 开启页。对外：(changed) / (complete)
// ============================================================

import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, type ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { focusIfIdle } from '@/lib/fmt';
import { CodeOpener, type CodeState } from '@/shared/code-opener';
import { CONTENTS } from '@/shared/host';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

@Component({
  selector: 'app-amber-code-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div
      class="code"
      [class.code--md]="size() === 'md'"
      [class.code--lg]="size() === 'lg'"
      [class.is-focused]="focused()"
      [class.is-error]="state() === 'error'"
      [class.is-checking]="state() === 'checking'"
      [class.is-ok]="state() === 'ok'"
      [class.is-shake]="shaking()"
    >
      <input
        #native
        class="code__native"
        type="text"
        inputmode="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="12"
        aria-label="8 位胶囊码"
        data-testid="code-input"
        [value]="value()"
        (input)="onInput($event)"
        (compositionend)="update(native.value, false)"
        (keydown.enter)="$event.preventDefault(); complete.emit(value())"
        (focus)="onFocus(native)"
        (blur)="focused.set(false)"
      />
      <div class="code__cells" aria-hidden="true">
        @for (ch of cells(); track $index; let i = $index) {
          <span
            class="code__cell"
            [class.has-gap]="i === 4"
            [class.is-filled]="!!ch"
            [class.is-pop]="!!ch && i >= popFrom()"
            [class.is-active]="i === activeAt()"
            data-code-cell=""
            [attr.data-value]="ch"
          >{{ ch }}</span>
        }
      </div>
    </div>
  `,
})
export class AmberCodeInputComponent {
  readonly size = input<'' | 'md' | 'lg'>('');
  readonly state = input.required<CodeState>();
  readonly shake = input.required<number>();
  readonly autofocus = input(false);
  readonly changed = output<string>();
  readonly complete = output<string>();

  protected readonly value = inject(CodeOpener).value;
  protected readonly focused = signal(false);
  protected readonly shaking = signal(false);
  /** 本次新敲进来的格子「弹」一下：从第几格开始弹 */
  protected readonly popFrom = signal(8);
  protected readonly cells = computed(() => Array.from({ length: 8 }, (_, i) => this.value()[i] ?? ''));
  protected readonly activeAt = computed(() => Math.min(this.value().length, 7));
  private readonly native = viewChild.required<ElementRef<HTMLInputElement>>('native');
  private readonly timers: number[] = [];

  constructor() {
    let first = true;
    effect(() => {
      const n = this.shake();
      if (first) return void (first = false);
      if (!n) return;
      untracked(() => {
        this.shaking.set(true);
        this.timers.push(window.setTimeout(() => this.shaking.set(false), 480));
      });
    });
    afterNextRender(() => {
      if (this.autofocus()) this.timers.push(window.setTimeout(() => focusIfIdle(this.native().nativeElement), 350));
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  protected update(raw: string, complete: boolean) {
    const v = clean(raw);
    this.popFrom.set(v.length > this.value().length ? this.value().length : 8);
    const el = this.native().nativeElement;
    if (el.value !== v) el.value = v;
    this.changed.emit(v);
    if (complete && v.length === 8) this.complete.emit(v);
  }

  protected onInput(e: Event) {
    if ((e as InputEvent).isComposing) return;
    this.update((e.target as HTMLInputElement).value, true);
  }

  protected onFocus(el: HTMLInputElement) {
    this.focused.set(true);
    const n = el.value.length;
    el.setSelectionRange(n, n);
  }
}
