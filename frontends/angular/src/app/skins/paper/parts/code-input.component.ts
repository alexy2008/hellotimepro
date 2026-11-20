// ============================================================
// 「时笺」8 格输码：8 个真实输入框（四四分组）。
// 粘贴、自动填充或一次填入整码（测试里的 fill）都会分发到各格。
// size：'' 为开启页的大号，'sm' 为首页的小号。
// 对外：(changed) / (complete)；公开方法 set() 供「粘贴识别」写入整码。
// ============================================================

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { focusIfIdle } from '@/lib/fmt';
import type { CodeState } from '@/shared/code-opener';
import { CONTENTS } from '@/shared/host';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

@Component({
  selector: 'app-paper-code-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div
      class="code"
      [class.code--sm]="size() === 'sm'"
      [class.is-error]="state() === 'error'"
      [class.is-checking]="state() === 'checking'"
      [class.is-ok]="state() === 'ok'"
      [class.is-shake]="shaking()"
      [attr.id]="codeId() ?? null"
      role="group"
      aria-label="8 位胶囊码"
    >
      @for (ch of cells(); track $index; let i = $index) {
        @if (i === 4) {
          <span class="code__dash" aria-hidden="true"></span>
        }
        <input
          #cell
          class="code__cell mono"
          [class.is-filled]="!!ch"
          type="text"
          inputmode="text"
          [maxLength]="i === 0 ? 8 : 1"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          [attr.aria-label]="'第 ' + (i + 1) + ' 位'"
          [style.--k]="i"
          [value]="ch"
          [attr.data-testid]="i === 0 ? 'code-input' : null"
          data-code-cell=""
          [attr.data-value]="ch"
          (focus)="cell.select()"
          (input)="onInput(i, cell)"
          (keydown)="onKey(i, $event)"
          (paste)="onPaste(i, $event)"
        />
      }
    </div>
  `,
})
export class PaperCodeInputComponent {
  readonly size = input<'' | 'sm'>('');
  readonly state = input.required<CodeState>();
  readonly shake = input.required<number>();
  readonly autofocus = input(false);
  readonly codeId = input<string>();
  readonly changed = output<string>();
  readonly complete = output<string>();

  protected readonly cells = signal<string[]>(Array(8).fill(''));
  protected readonly shaking = signal(false);
  /** viewChildren 按模板顺序给出 8 个格子 */
  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('cell');
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
        this.focusAt(7);
      });
    });
    afterNextRender(() => {
      if (this.autofocus()) this.timers.push(window.setTimeout(() => focusIfIdle(this.inputs()[0]?.nativeElement), 350));
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  private focusAt(i: number) {
    this.inputs()[Math.min(7, i)]?.nativeElement.focus();
  }

  private commit(next: string[], focusAt: number, completeNow: boolean) {
    this.cells.set(next);
    const v = next.join('');
    this.changed.emit(v);
    this.focusAt(focusAt);
    if (completeNow && v.length === 8) this.complete.emit(v);
  }

  /** 从第 from 格开始填入一串字符 */
  private fill(str: string, from: number) {
    const s = clean(str).slice(0, 8 - from);
    const next = [...this.cells()];
    Array.from(s).forEach((ch, k) => (next[from + k] = ch));
    this.commit(next, from + s.length, true);
  }

  protected onInput(i: number, el: HTMLInputElement) {
    const v = clean(el.value);
    // 一次进来不止一个字符：当作从这一格开始粘贴（整码则从头填）
    if (v.length > 1) return this.fill(v, v.length >= 8 ? 0 : i);
    el.value = v; // 丢掉的非法字符不留在框里
    const next = [...this.cells()];
    next[i] = v;
    this.commit(next, v && i < 7 ? i + 1 : i, i === 7 && !!v);
  }

  protected onKey(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !this.cells()[i] && i > 0) {
      e.preventDefault();
      const next = [...this.cells()];
      next[i - 1] = '';
      this.commit(next, i - 1, false);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      this.focusAt(i - 1);
    } else if (e.key === 'ArrowRight' && i < 7) {
      e.preventDefault();
      this.focusAt(i + 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.complete.emit(this.cells().join(''));
    }
  }

  protected onPaste(i: number, e: ClipboardEvent) {
    e.preventDefault();
    const t = clean(e.clipboardData?.getData('text') ?? '');
    if (t) this.fill(t, t.length >= 8 ? 0 : i);
  }

  /** 外部写入整码（粘贴识别用） */
  set(v: string) {
    const s = clean(v).slice(0, 8);
    this.commit(Array.from({ length: 8 }, (_, k) => s[k] ?? ''), s.length, true);
  }
}
