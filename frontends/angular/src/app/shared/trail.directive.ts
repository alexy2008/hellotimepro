// 标记表单字段右侧的小部件（眼睛、昵称状态、锁）：<span appTrail …>，由 FieldComponent 投影到输入框旁
import { Directive } from '@angular/core';

@Directive({ selector: '[appTrail]' })
export class TrailDirective {}
