// ============================================================
// 时间与数字的说法：模板里 {{ c.openAt | fmt: 'date' }}。
// 纯管道：输入不变就不重算（倒计时这类每秒变的值直接在组件里算）。
// 入参可以是接口给的 ISO 字符串，也可以是毫秒时间戳。
// ============================================================

import { Pipe, type PipeTransform } from '@angular/core';
import { fmt, ms } from '@/lib/fmt';

export type FmtKind = 'date' | 'dash' | 'time' | 'timeSec' | 'dateTime' | 'dashTime' | 'cn' | 'week' | 'full' | 'lunar' | 'num' | 'span' | 'year';

@Pipe({ name: 'fmt' })
export class FmtPipe implements PipeTransform {
  transform(v: string | number | null | undefined, kind: FmtKind): string {
    if (v == null) return '';
    if (kind === 'num') return fmt.num(Number(v));
    if (kind === 'span') return fmt.span(Number(v));
    const t = ms(v);
    switch (kind) {
      case 'date':
        return fmt.date(t);
      case 'dash':
        return fmt.date(t).replace(/\./g, '-');
      case 'time':
        return fmt.time(t);
      case 'timeSec':
        return fmt.time(t, true);
      case 'dateTime':
        return fmt.dateTime(t);
      case 'dashTime':
        return fmt.dateTime(t).replace(/\./g, '-');
      case 'cn':
        return fmt.cn(t);
      case 'week':
        return fmt.week(t);
      case 'full':
        return fmt.full(t);
      case 'lunar':
        return fmt.lunar(t);
      case 'year':
        return String(new Date(t).getFullYear());
    }
  }
}
