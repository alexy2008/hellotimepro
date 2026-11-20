// 登录 / 注册卡片顶上的小景：一枚在轨道上缓缓转动的胶囊
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';

@Component({
  selector: 'div[appAmberAuthArt]',
  imports: [AmberCapsuleArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'auth__art', 'aria-hidden': 'true' },
  template: `<span class="auth__orbit"></span><span class="auth__orbit auth__orbit--2"></span><svg appAmberCapsuleArt [code]="null" [state]="state()" [width]="180"></svg>`,
})
export class AmberAuthArtComponent {
  readonly state = input.required<'locked' | 'opened'>();
}
