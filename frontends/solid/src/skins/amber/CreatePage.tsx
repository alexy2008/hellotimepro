// ============================================================
// 「琥珀」创建页（/create）
// 左：表单卡（标题 · AI 代笔 · 灵感 · 正文 · 开启时间 · 发布到广场）
// 右：实时预览 + 须知
// 封存后：胶囊合拢，8 位码牌逐个翻出
// 结构与类名照 2.0 原型 amber/view-create.js
// ============================================================

import { For, Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { fmt, focusIfIdle, readLimitedInput, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { auth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { createShake } from "@/components/forms";
import { shareOf } from "@/primitives/capsule";
import { DAY, type CapsuleForm } from "@/primitives/capsuleForm";
import { useNow } from "@/primitives/now";
import type { CapsuleDetail } from "@/types";
import { Badge, CapsuleArt, Tiles, VisBadge } from "./parts";
import { DateTimePicker } from "./DateTimePicker";

const PRESETS = [
  { key: "1m", label: "1 分钟后" },
  { key: "tm", label: "明早 9 点" },
  { key: "1w", label: "一周后" },
  { key: "1mo", label: "一个月后" },
  { key: "1y", label: "一年后" },
  { key: "5y", label: "五年后" },
  { key: "10y", label: "十年后" },
];

const dash = (t: number) => fmt.dateTime(t).replace(/\./g, "-");

/* ---------- 封存完成：胶囊合拢，码牌逐个翻出 ---------- */
function Sealed(props: { c: CapsuleDetail; onAgain: () => void }) {
  const c = props.c;
  const [inn, setIn] = createSignal(false);
  const { copyCode, copyLink } = shareOf(c.code);
  const openAt = new Date(c.openAt).getTime();
  onMount(() => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setIn(true)));
    onCleanup(() => cancelAnimationFrame(r));
  });
  return (
    <section class={`sealed card${inn() ? " is-in" : ""}`} style={{ "--glow": paletteOf(c.code).glow }} data-testid="sealed-receipt" data-code={c.code}>
      <div class="sealed__art">
        <CapsuleArt code={c.code} state={inn() ? "locked" : "opened"} width={260} />
      </div>
      <div class="eyebrow eyebrow--center">Sealed</div>
      <h1 class="page-title">胶囊已封存</h1>
      <p class="page-lead">下面这串胶囊码是开启它的钥匙，{c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}</p>
      <div class="tiles mono" aria-label={`胶囊码 ${c.code}`} data-testid="sealed-code">
        <Tiles code={c.code} />
      </div>
      <div class="sealed__act">
        <button class="btn btn--primary" type="button" data-testid="copy-code" onClick={copyCode}>
          <Icon name="copy" />
          复制胶囊码
        </button>
        <button class="btn btn--ghost" type="button" data-testid="copy-link" onClick={copyLink}>
          <Icon name="link" />
          复制开启链接
        </button>
      </div>
      <dl class="sealed__meta">
        <div>
          <dt>标题</dt>
          <dd>{c.title}</dd>
        </div>
        <div>
          <dt>开启时间</dt>
          <dd class="mono">{dash(openAt)}</dd>
        </div>
        <div>
          <dt>沉睡时长</dt>
          <dd>{fmt.span(openAt - Date.now())}</dd>
        </div>
        <div>
          <dt>属性</dt>
          <dd>
            <VisBadge inPlaza={c.inPlaza} />
          </dd>
        </div>
      </dl>
      <div class="sealed__links">
        <a class="link-btn" href={`/capsules/${c.code}`} data-testid="receipt-view">
          看看它的倒计时
          <Icon name="arrow" />
        </a>
        <button class="link-btn" type="button" data-testid="receipt-again" onClick={() => props.onAgain()}>
          再写一枚
          <Icon name="plus" />
        </button>
        <a class="link-btn" href="/me/created">
          我创建的
          <Icon name="feather" />
        </a>
      </div>
    </section>
  );
}

export function AmberCreatePage(props: { f: CapsuleForm }) {
  const f = props.f;
  const d = f.draft;
  const me = () => auth.user!;
  const now = useNow();
  let titleEl: HTMLInputElement | undefined;
  let contentEl: HTMLTextAreaElement | undefined;
  const titleShake = createShake(() => f.shake.title);
  const contentShake = createShake(() => f.shake.content);
  const openShake = createShake(() => f.shake.openAt);
  const span = () => d.openAt - now();

  onMount(() => {
    const t = setTimeout(() => focusIfIdle(titleEl), 380);
    onCleanup(() => clearTimeout(t));
  });

  // 正文框随内容长高（封存回执出现时表单不在，contentEl 已解绑）
  createEffect(
    on(
      () => [d.content, f.created()],
      () => {
        if (!contentEl?.isConnected) return;
        contentEl.style.height = "auto";
        contentEl.style.height = Math.max(contentEl.scrollHeight, 36 * 8) + "px";
      },
    ),
  );

  // 校验失败：把出错的字段滚到眼前
  createEffect(
    on(
      () => [f.shake.title, f.shake.content, f.shake.openAt],
      () => {
        document.querySelector(".field.is-shake")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
        if (f.errors.title) titleEl?.focus({ preventScroll: true });
        else if (f.errors.content) contentEl?.focus({ preventScroll: true });
      },
      { defer: true },
    ),
  );

  return (
    <Show
      when={!f.created()}
      fallback={
        <div class="page page--create">
          <div class="container">
            <Sealed c={f.created()!} onAgain={f.again} />
          </div>
        </div>
      }
    >
      <div class="page page--create">
        <div class="container">
          <header class="page-head">
            <div class="eyebrow">Seal a capsule</div>
            <h1 class="page-title">写一枚胶囊</h1>
            <p class="page-lead">写给未来的自己，或者某个还没出现的人。合上之后，在开启时间到来之前，没有任何人能读到它。</p>
          </header>

          <div class="create">
            <form
              class="create__form card"
              novalidate
              onSubmit={(e) => {
                e.preventDefault();
                void f.submit();
              }}
            >
              <div class={`field${titleShake()}`} data-field="title">
                <div class="field__head">
                  <label class="field__label" for="title">
                    标题 <em>*</em>
                  </label>
                  <span class="field__count mono">
                    <b>{Array.from(d.title).length}</b>/60
                  </span>
                </div>
                <div class="input-wrap input-wrap--action">
                  <input
                    ref={titleEl}
                    class="input"
                    id="title"
                    autocomplete="off"
                    placeholder="给这枚胶囊起个名字"
                    data-testid="create-title"
                    value={d.title}
                    onInput={(e) => f.setTitle(readLimitedInput(e.currentTarget, 60))}
                  />
                  <button
                    class={`ai-btn${f.aiBusy() ? " is-busy" : ""}`}
                    type="button"
                    data-testid="ai-generate"
                    title="让 AI 代写正文并建议开启时间；标题留空时会顺便起个标题"
                    onClick={() => void f.aiWrite()}
                  >
                    <Icon name="sparkle" />
                    <span>{f.aiBusy() ? "代笔中…" : f.aiDone() ? "重新代笔" : "AI 代笔"}</span>
                  </button>
                </div>
                <div class="field__error" role="alert" data-testid={f.errors.title ? "field-error" : undefined} data-field="title">
                  {f.errors.title}
                </div>
              </div>

              <div class={`recos${f.showRecos() ? "" : " is-hidden"}`} data-testid={f.showRecos() ? "ai-reco" : undefined}>
                <div class="recos__in">
                  <div class="recos__head">
                    <span>
                      <Icon name="sparkle" />
                      没有头绪？从一个灵感开始
                    </span>
                    <button class="link-btn" type="button" data-testid="reco-refresh" disabled={f.recoBusy() || f.aiBusy()} onClick={() => void f.refreshRecos()}>
                      <Icon name="refresh" />
                      {f.recoBusy() ? "换一批中…" : "换一批"}
                    </button>
                  </div>
                  <div class="recos__list">
                    <For each={f.recos()}>
                      {(r, i) => (
                        <button class="reco" type="button" style={{ "--i": i() }} data-testid="reco-chip" disabled={f.aiBusy()} onClick={() => void f.aiWrite(r.title)}>
                          <b>{r.title}</b>
                          <span>{r.hint}</span>
                          <em>
                            <Icon name="clock" />
                            {fmt.span(r.openInDays * DAY)}后
                          </em>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>

              <div class={`field${contentShake()}`} data-field="content">
                <div class="field__head">
                  <label class="field__label" for="content">
                    内容 <em>*</em>
                  </label>
                  <span class="field__count mono">
                    <b>{fmt.num(Array.from(d.content).length)}</b>/5000
                  </span>
                </div>
                <div class={`paper${f.aiBusy() ? " is-ai" : ""}${f.aiThinking() ? " is-thinking" : ""}`}>
                  <textarea
                    ref={contentEl}
                    class="paper__text"
                    id="content"
                    rows={9}
                    placeholder={"在这里写下想交给未来的话。\n可以是此刻的天气、正在读的书、一个小小的约定，\n或者只是一句：嘿，你还好吗？"}
                    data-testid="create-content"
                    value={d.content}
                    onInput={(e) => f.setContent(readLimitedInput(e.currentTarget, 5000))}
                  />
                  <div class="paper__think" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div class="field__hint">
                  <Show when={f.aiNote()}>
                    <span class="ai-note">
                      <Icon name="sparkle" />
                      {f.aiNote()}
                    </span>
                  </Show>
                </div>
                <div class="field__error" role="alert" data-testid={f.errors.content ? "field-error" : undefined} data-field="content">
                  {f.errors.content}
                </div>
              </div>

              <div class={`field${openShake()}`} data-field="openAt">
                <div class="field__head">
                  <label class="field__label" for="openAt">
                    开启时间 <em>*</em>
                  </label>
                  <span class="field__count">最早 1 分钟后 · 最晚 10 年内</span>
                </div>
                <DateTimePicker value={d.openAt} onChange={(t) => f.setOpenAt(t)} />
                <div class="chips">
                  <For each={PRESETS}>
                    {(p) => (
                      <button
                        class={`chip${d.preset === p.key ? " is-active" : ""}`}
                        type="button"
                        data-testid="openat-preset"
                        data-preset={p.key}
                        data-value={p.key}
                        data-selected={String(d.preset === p.key)}
                        onClick={() => f.pickPreset(p.key)}
                      >
                        {p.label}
                      </button>
                    )}
                  </For>
                </div>
                <div class="field__error" role="alert" data-testid={f.errors.openAt ? "field-error" : undefined} data-field="openAt">
                  {f.errors.openAt}
                </div>
              </div>

              <label class={`toggle-card${d.inPlaza ? " is-on" : ""}`}>
                <span class="toggle-card__ic">
                  <Icon name="globe" />
                </span>
                <span class="toggle-card__txt">
                  <b>发布到胶囊广场</b>
                  <small>{d.inPlaza ? "标题与昵称公开展示，内容到时间才可见" : "不出现在广场；把胶囊码交给谁，谁才能找到它"}</small>
                </span>
                <input type="checkbox" class="sr-only" checked={d.inPlaza} data-testid="create-in-plaza" onChange={(e) => f.setInPlaza(e.currentTarget.checked)} />
                <span class="switch" aria-hidden="true" />
              </label>

              <div class="create__foot">
                <div class="create__sum">
                  <Icon name="hourglass" />
                  <Show when={!d.openAtMissing && span() > 0} fallback={<span>选一个开启的时刻</span>}>
                    <span>
                      将沉睡 <b>{fmt.span(span())}</b>，于 {fmt.full(d.openAt)} 开启
                    </span>
                  </Show>
                </div>
                <button class={`btn btn--primary btn--lg${f.submitting() ? " is-busy" : ""}`} type="submit" disabled={f.submitting()} data-testid="create-submit">
                  <Icon name="lock" />
                  <span>{f.submitting() ? "正在封存…" : "封存胶囊"}</span>
                </button>
              </div>
            </form>

            <aside class="create__side">
              <div class="preview card">
                <div class="preview__head">
                  <span class="eyebrow">实时预览</span>
                  <span class="badge badge--amber">尚未封存</span>
                </div>
                <div class="preview__art">
                  <CapsuleArt code={null} state="opened" width={220} />
                </div>
                <h3 class="preview__title">{d.title.trim() || "未命名的胶囊"}</h3>
                <div class="preview__by">
                  <Avatar id={me().avatarId} />
                  {me().nickname}
                </div>
                <dl class="preview__table">
                  <div>
                    <dt>开启时间</dt>
                    <dd class="mono">{d.openAtMissing ? "待选择" : dash(d.openAt)}</dd>
                  </div>
                  <div>
                    <dt>沉睡时长</dt>
                    <dd>{!d.openAtMissing && span() > 0 ? fmt.span(span()) : "—"}</dd>
                  </div>
                  <div>
                    <dt>正文</dt>
                    <dd>{fmt.num(Array.from(d.content).length)} 字</dd>
                  </div>
                </dl>
                <div class="badges">
                  <VisBadge inPlaza={d.inPlaza} />
                  <Badge kind="amber" icon="clock">
                    {fmt.span(Math.max(span(), 0))}后
                  </Badge>
                </div>
              </div>
              <ul class="notes">
                <li>
                  <Icon name="key" />
                  <span>封存后会得到一串 8 位胶囊码，它是开启胶囊的凭证，也能分享给别人。</span>
                </li>
                <li>
                  <Icon name="lock" />
                  <span>到开启时间之前，内容对所有人不可见——包括写下它的你。</span>
                </li>
                <li>
                  <Icon name="trash" />
                  <span>封存后，内容和开启时间都不能再修改；可以在「我创建的」里删除。</span>
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </Show>
  );
}
