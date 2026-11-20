// 复制胶囊码与分享链接（回执、「我创建的」、详情页都用）
import { inject, Injectable } from '@angular/core';
import { copyText, FeedbackStore } from '@/stores/feedback.store';

@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly feedback = inject(FeedbackStore);

  async copyCode(code: string) {
    await copyText(code);
    this.feedback.toast(`已复制胶囊码 ${code}`);
  }

  async copyLink(code: string) {
    await copyText(`${location.origin}/capsules/${code}`);
    this.feedback.toast('已复制分享链接');
  }
}
