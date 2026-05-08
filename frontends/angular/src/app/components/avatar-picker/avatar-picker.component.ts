import { Component, input, output } from '@angular/core';
import { avatarUrl } from '@/utils/avatar';
import type { Avatar } from '@/types';

@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  template: `
    <div class="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
      @for (a of avatars(); track a.id) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value() === a.id"
          [class]="'cy-avatar-picker__item ' + (value() === a.id ? 'is-selected' : '')"
          (click)="onChange.emit(a.id)"
          [title]="a.name"
        >
          <img [src]="a.svgUrl ?? avatarUrl(a.id)" [alt]="a.name" />
        </button>
      }
    </div>
  `,
})
export class AvatarPickerComponent {
  avatars = input<Avatar[]>([]);
  value = input<string | null>(null);
  onChange = output<string>();
  avatarUrl = avatarUrl;
}
