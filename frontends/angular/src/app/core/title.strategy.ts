// 路由上的 title 统一加后缀「 · HelloTime Pro」；详情页没有固定标题，等胶囊取回来后由 CapsuleFacade 写
import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';

@Injectable()
export class SuffixTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const t = this.buildTitle(snapshot);
    if (t) this.title.setTitle(`${t} · HelloTime Pro`);
  }
}
