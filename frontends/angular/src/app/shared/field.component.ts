// ============================================================
// 表单字段：两套皮肤结构相同、外框不同——时笺是下划线信笺栏，琥珀是带图标的输入框。逻辑只写一份。
// - 值用 [(value)] 双向绑定（model 信号）
// - password：右侧自带一只眼睛，点一下明文 / 密文切换
// - 输入框右侧的其他小部件（昵称状态、锁）写成 <span appTrail …>，投影进来
// - 出错时自带 field-error 测试钩子，并抖一下
// 输入框与投影位置各写成一个 ng-template，两个皮肤分支里用 ngTemplateOutlet 放进去
// ============================================================

import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { UiStore } from '@/stores/ui.store';
import { focusIfIdle } from '@/lib/fmt';
import type { IconName } from '@/lib/icons';
import { IconDirective } from './icon.directive';
import { ShakeDirective } from './shake.directive';
import { TrailDirective } from './trail.directive';
import { CONTENTS } from './host';

@Component({
  selector: 'app-field',
  imports: [NgTemplateOutlet, IconDirective, ShakeDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <ng-template #inputTpl let-cls>
      <input
        #inp
        [class]="cls"
        [id]="fieldId()"
        [name]="fieldId()"
        [type]="inputType()"
        [value]="value()"
        [attr.autocomplete]="autocomplete() ?? null"
        [attr.placeholder]="placeholder() ?? null"
        [attr.maxlength]="maxlength() ?? null"
        [disabled]="disabled()"
        [attr.aria-describedby]="fieldId() + '-hint'"
        [attr.aria-invalid]="error() ? true : null"
        [attr.data-testid]="testId() ?? null"
        (input)="onInput($event)"
      />
    </ng-template>
    <ng-template #trailTpl>
      @if (password()) {
        <button
          [class]="ui.skin() === 'paper' ? 'field__eye' : 'input-wrap__action icon-btn'"
          type="button"
          [attr.aria-label]="show() ? '隐藏密码' : '显示密码'"
          (click)="show.set(!show())"
        >
          <svg [appIcon]="show() ? 'eye-off' : 'eye'"></svg>
        </button>
      }
      <ng-content select="[appTrail]" />
    </ng-template>

    <div class="field" [class.is-error]="!!error()" [class.is-ok]="!error() && !!ok()" [attr.data-field]="fieldId()">
      @if (ui.skin() === 'paper') {
        <label class="field__label" [for]="fieldId()">{{ label() }}</label>
        <div class="field__box" [appShake]="error()">
          <ng-container *ngTemplateOutlet="inputTpl; context: { $implicit: 'field__input' }" />
          <ng-container *ngTemplateOutlet="trailTpl" />
          <span class="field__line"></span>
        </div>
      } @else {
        <div class="field__head">
          <label class="field__label" [for]="fieldId()">{{ label() }}@if (req()) {<em> *</em>}</label>
        </div>
        <div class="input-wrap" [class.input-wrap--icon]="!!lead()" [class.input-wrap--action]="hasTrail()" [appShake]="error()">
          @if (lead(); as icon) {
            <svg [appIcon]="icon" class="input-wrap__icon"></svg>
          }
          <ng-container *ngTemplateOutlet="inputTpl; context: { $implicit: 'input' }" />
          <ng-container *ngTemplateOutlet="trailTpl" />
        </div>
      }
      <div
        class="field__hint"
        [id]="fieldId() + '-hint'"
        [attr.data-testid]="error() ? 'field-error' : null"
        [attr.data-field]="error() ? (errorKey() ?? fieldId()) : null"
      >{{ error() || ok() || hint() }}</div>
    </div>
  `,
})
export class FieldComponent {
  readonly value = model('');
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly type = input('text');
  readonly password = input(false);
  readonly hint = input<string>();
  readonly error = input<string>();
  readonly ok = input<string>();
  /** 琥珀：标签后的星号 */
  readonly req = input(false);
  /** 琥珀：输入框左侧的图标 */
  readonly lead = input<IconName>();
  readonly testId = input<string>();
  /** 出错时提示上的 data-field（测试钩子 field-error 用），默认取 fieldId */
  readonly errorKey = input<string>();
  readonly autocomplete = input<string>();
  readonly placeholder = input<string>();
  readonly maxlength = input<number>();
  readonly disabled = input(false);
  readonly autofocus = input(false);

  protected readonly ui = inject(UiStore);
  protected readonly show = signal(false);
  private readonly trail = contentChild(TrailDirective);
  private readonly inp = viewChild<ElementRef<HTMLInputElement>>('inp');
  protected readonly hasTrail = computed(() => this.password() || !!this.trail());
  protected readonly inputType = computed(() => (this.password() ? (this.show() ? 'text' : 'password') : this.type()));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.autofocus()) return;
      const t = window.setTimeout(() => focusIfIdle(this.inp()?.nativeElement), 380);
      destroyRef.onDestroy(() => clearTimeout(t));
    });
  }

  protected onInput(e: Event) {
    this.value.set((e.target as HTMLInputElement).value);
  }
}
