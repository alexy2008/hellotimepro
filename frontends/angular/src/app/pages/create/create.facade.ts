// ============================================================
// 创建页的页面逻辑（/create），由 CreatePage 提供、两套皮肤注入同一份：
// - 草稿在 DraftStore（全局、只在内存）：离开再回来都接着写；封存成功、登出、换账号时清空
// - 校验：文案以 spec/ui/copy.md 为准
// - AI：推荐主题（序号守卫防乱序、空列表不覆盖已有推荐）、代笔（打字机效果，可被打断）
// - 封存：调接口，回执交给皮肤展示
// 这份 Facade 跟着页面走：切皮肤还在（错误、推荐、回执都不丢），离开页面就销毁
// ============================================================

import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { DraftStore } from '@/stores/draft.store';
import { FeedbackStore } from '@/stores/feedback.store';
import { ApiError, type CapsuleDetail, type CapsuleRecommendation } from '@/types';
import { fmt, reducedMotion, sleep } from '@/lib/fmt';
import { LIMITS, MSG, PRESET_AT } from '@/lib/schedule';

export type Field = 'title' | 'content' | 'openAt';
type Errors = Partial<Record<Field, string>>;

@Injectable()
export class CreateFacade {
  private readonly api = inject(ApiService);
  private readonly feedback = inject(FeedbackStore);
  private readonly auth = inject(AuthStore);
  readonly draft = inject(DraftStore);

  readonly errors = signal<Errors>({});
  /** 每次校验失败给对应字段加一，视图据此「抖一下」 */
  readonly shake = signal<Record<Field, number>>({ title: 0, content: 0, openAt: 0 });
  readonly submitting = signal(false);
  readonly created = signal<CapsuleDetail | null>(null);

  readonly recos = signal<CapsuleRecommendation[]>([]);
  readonly recoBusy = signal(false);
  readonly aiBusy = signal(false);
  readonly aiThinking = signal(false);
  readonly aiDone = signal(false);
  readonly aiNote = signal('');
  readonly showRecos = computed(() => !this.draft.title().trim() && this.recos().length > 0);

  private recoSeq = 0;
  private typeToken = 0;

  constructor() {
    // 开启时间：草稿里的时刻可能已经过期（离开太久），进来时顺延到合法范围
    if (this.draft.openAt() < LIMITS.minOpen()) this.patch({ openAt: PRESET_AT['1y'](), preset: '1y' });
    inject(DestroyRef).onDestroy(() => this.typeToken++); // 离开页面时停止打字
    void this.refreshRecos();
  }

  private patch(p: Partial<{ title: string; content: string; openAt: number; preset: string | null; inPlaza: boolean }>) {
    this.draft.patch(p);
  }

  private fail(f: Field, msg: string) {
    this.errors.update((e) => ({ ...e, [f]: msg }));
    this.shake.update((s) => ({ ...s, [f]: s[f] + 1 }));
  }

  private clearErr(f?: Field) {
    this.errors.update((e) => (f ? { ...e, [f]: undefined } : {}));
  }

  // ---------------------------------------------------------------- 字段

  setTitle(title: string) {
    if (this.aiBusy()) this.stopTyping();
    this.clearErr('title');
    this.patch({ title });
  }

  setContent(content: string) {
    if (this.aiBusy()) this.stopTyping(); // 用户自己动手改了：AI 让位
    this.clearErr('content');
    this.patch({ content });
  }

  setOpenAt(openAt: number, preset: string | null = null) {
    if (this.aiBusy()) this.stopTyping();
    this.clearErr('openAt');
    this.patch({ openAt, preset });
  }

  pickPreset(key: string) {
    this.setOpenAt(PRESET_AT[key](), key);
  }

  setInPlaza(inPlaza: boolean) {
    this.patch({ inPlaza });
  }

  // ---------------------------------------------------------------- AI

  async refreshRecos() {
    const my = ++this.recoSeq;
    this.recoBusy.set(true);
    try {
      const r = await this.api.capsuleRecommendations({ count: 4 });
      if (my !== this.recoSeq) return;
      // LLM 不可用时返回空数组：静默，不覆盖已有推荐
      if (r.items.length) this.recos.set(r.items);
    } catch {
      /* 推荐失败也静默 */
    } finally {
      if (my === this.recoSeq) this.recoBusy.set(false);
    }
  }

  stopTyping() {
    this.typeToken++;
    this.aiBusy.set(false);
    this.aiThinking.set(false);
  }

  /** 打字机：逐字写进去，标点处稍停；被打断（token 变了）就返回 false */
  private async typeInto(which: 'title' | 'content', text: string, token: number) {
    if (reducedMotion()) {
      this.patch({ [which]: text });
      return true;
    }
    const step = which === 'title' ? 1 : 3;
    for (let i = 0; i <= text.length; i += step) {
      if (token !== this.typeToken) return false;
      this.patch({ [which]: text.slice(0, i) });
      await sleep(/[，。？！、—…：\n]/.test(text[i - 1] ?? '') ? 50 : 14);
    }
    if (token !== this.typeToken) return false;
    this.patch({ [which]: text });
    return true;
  }

  /** AI 代笔：标题留空时连标题一起生成；forcedTitle 来自点选的推荐主题 */
  async aiWrite(forcedTitle?: string) {
    if (this.aiBusy()) return;
    const token = ++this.typeToken;
    const typed = (forcedTitle ?? this.draft.title()).trim();
    const auto = !typed;
    this.aiBusy.set(true);
    this.aiThinking.set(true);
    this.aiNote.set('');
    this.clearErr();
    if (forcedTitle != null) this.patch({ title: forcedTitle });
    // 请求成功之前不动用户已写的正文：失败时原文还在；
    // 等待期间用户改了正文（setContent 会让 token 失效），结果就不再覆盖
    try {
      const s = await this.api.suggestCapsule({ title: typed || undefined });
      if (token !== this.typeToken) return;
      this.aiThinking.set(false);
      if (auto && !(await this.typeInto('title', s.title ?? typed, token))) return;
      this.patch({
        content: '',
        openAt: Math.min(Math.max(new Date(s.openAt).getTime(), LIMITS.minOpen() + 30_000), LIMITS.maxOpen()),
        preset: null,
      });
      if (!(await this.typeInto('content', s.content, token))) return;
      const source = s.generatedBy === 'local-template' ? '本地模板（LLM 未启用）' : s.generatedBy;
      this.aiNote.set(`${auto ? '标题与正文均由 AI 代笔' : '已为你代笔'}，建议 ${fmt.num(s.openInDays)} 天后开启 · 来源 ${source}`);
      this.aiDone.set(true);
    } catch (e) {
      if (token === this.typeToken) this.feedback.toast(e instanceof ApiError ? e.message : 'AI 暂时没有回应，请稍后再试', { tone: 'error' });
    } finally {
      if (token === this.typeToken) {
        this.aiBusy.set(false);
        this.aiThinking.set(false);
      }
    }
  }

  // ---------------------------------------------------------------- 校验与封存

  /** 校验通过返回 true；不通过时标出字段并抖一下 */
  validate(): boolean {
    if (this.aiBusy()) this.stopTyping();
    const d = this.draft;
    if (!d.title().trim()) return this.fail('title', MSG.title), false;
    if (!d.content().trim()) return this.fail('content', MSG.content), false;
    if (d.openAt() < LIMITS.minOpen()) return this.fail('openAt', MSG.openMin), false;
    if (d.openAt() > LIMITS.maxOpen()) return this.fail('openAt', MSG.openMax), false;
    return true;
  }

  async submit(): Promise<CapsuleDetail | null> {
    if (this.submitting() || !this.validate()) return null;
    this.submitting.set(true);
    const owner = this.auth.user()?.id;
    const revision = this.draft.revision();
    const d = this.draft;
    try {
      const c = await this.api.createCapsule({
        title: d.title().trim(),
        content: d.content(),
        openAt: new Date(d.openAt()).toISOString(),
        inPlaza: d.inPlaza(),
      });
      if (this.auth.user()?.id !== owner) return null;
      this.created.set(c);
      if (revision === d.revision()) d.reset();
      return c;
    } catch (e) {
      this.feedback.toast(e instanceof ApiError ? e.message : '封存失败，请稍后再试', { tone: 'error' });
      return null;
    } finally {
      this.submitting.set(false);
    }
  }

  again() {
    this.created.set(null);
    this.aiDone.set(false);
    this.aiNote.set('');
    this.clearErr();
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}
