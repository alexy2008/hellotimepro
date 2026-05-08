import {
  Component, ElementRef, input, OnChanges, output, QueryList,
  SimpleChanges, ViewChildren,
} from '@angular/core';

const LEN = 8;

@Component({
  selector: 'app-capsule-code-input',
  standalone: true,
  template: `
    <div class="cy-code-input">
      @for (ch of chars; track $index; let i = $index) {
        <input
          #cell
          type="text"
          inputmode="text"
          autocapitalize="characters"
          maxlength="1"
          [value]="ch"
          [attr.aria-label]="'第 ' + (i + 1) + ' 位'"
          (input)="onInput(i, $event)"
          (keydown)="onKeydown(i, $event)"
          (paste)="onPaste(i, $event)"
        />
      }
    </div>
  `,
})
export class CapsuleCodeInputComponent implements OnChanges {
  @ViewChildren('cell') cells!: QueryList<ElementRef<HTMLInputElement>>;
  value = input('');
  onChange = output<string>();
  onComplete = output<string>();

  chars: string[] = Array(LEN).fill('');

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      const v = (this.value() ?? '').toUpperCase();
      this.chars = Array.from({ length: LEN }, (_, i) => v[i] ?? '');
      if (v.length === LEN) this.onComplete.emit(v);
    }
  }

  onInput(i: number, e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    const ch = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    const next = [...this.chars];
    next[i] = ch;
    const str = next.join('').slice(0, LEN);
    this.onChange.emit(str);
    if (ch && i < LEN - 1) {
      this.cells.toArray()[i + 1]?.nativeElement.focus();
    }
  }

  onKeydown(i: number, e: KeyboardEvent) {
    const els = this.cells.toArray();
    if (e.key === 'Backspace' && !this.chars[i] && i > 0) {
      els[i - 1]?.nativeElement.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      els[i - 1]?.nativeElement.focus();
    } else if (e.key === 'ArrowRight' && i < LEN - 1) {
      els[i + 1]?.nativeElement.focus();
    }
  }

  onPaste(_i: number, e: ClipboardEvent) {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text') ?? '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LEN);
    this.onChange.emit(text);
    const focus = Math.min(text.length, LEN - 1);
    this.cells.toArray()[focus]?.nativeElement.focus();
  }
}
