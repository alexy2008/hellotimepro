<!-- ============================================================
     「琥珀」创建页（/create）
     左：表单卡（标题 · AI 代笔 · 灵感 · 正文 · 开启时间 · 发布到广场）
     右：实时预览 + 须知
     封存后：胶囊合拢，8 位码牌逐个翻出
     结构与类名照 2.0 原型 amber/view-create.js；表单状态来自创建路由（useCreateForm）
     ============================================================ -->
<script lang="ts">
  import { tick, untrack } from "svelte";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { clock } from "@/stores/clock.svelte.ts";
  import { fmt, reducedMotion } from "@/lib/fmt";
  import { DAY } from "@/lib/schedule";
  import { autofocus } from "@/lib/attach";
  import { useShake } from "@/lib/motion.svelte.ts";
  import { useCreateForm } from "@/state/create-form.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import AmberBadge from "./AmberBadge.svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import AmberDateTimePicker from "./AmberDateTimePicker.svelte";
  import AmberSealed from "./AmberSealed.svelte";
  import AmberVisBadge from "./AmberVisBadge.svelte";
  import { dash } from "./art";

  const PRESETS = [
    { key: "1m", label: "1 分钟后" },
    { key: "tm", label: "明早 9 点" },
    { key: "1w", label: "一周后" },
    { key: "1mo", label: "一个月后" },
    { key: "1y", label: "一年后" },
    { key: "5y", label: "五年后" },
    { key: "10y", label: "十年后" },
  ];

  const f = useCreateForm();
  const me = $derived(authStore.user!);
  const now = $derived(clock.now);
  let titleEl = $state<HTMLInputElement>();
  let contentEl = $state<HTMLTextAreaElement>();
  const titleShake = useShake(() => f.shake.title);
  const contentShake = useShake(() => f.shake.content);
  const openShake = useShake(() => f.shake.openAt);
  const span = $derived(f.draft.openAtMissing ? 0 : f.draft.openAt - now);
  const contentLength = $derived(Array.from(f.content).length);

  // 正文框随内容长高
  $effect(() => {
    void f.content;
    if (!contentEl) return;
    contentEl.style.height = "auto";
    contentEl.style.height = Math.max(contentEl.scrollHeight, 36 * 8) + "px";
  });

  // 校验失败：等「抖一下」的类名上了 DOM，再把出错的字段滚到眼前（挂载时的旧计数不算）
  let lastFail = untrack(() => f.shake.title + f.shake.content + f.shake.openAt);
  $effect(() => {
    const n = f.shake.title + f.shake.content + f.shake.openAt;
    if (n === lastFail) return;
    lastFail = n;
    void tick().then(() => {
      document.querySelector(".field.is-shake")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
      if (f.errors.title) titleEl?.focus({ preventScroll: true });
      else if (f.errors.content) contentEl?.focus({ preventScroll: true });
    });
  });
  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void f.submit();
  }
</script>

<div class="page page--create">
  <div class="container">
    {#if f.created}
      <AmberSealed c={f.created} onagain={f.again} />
    {:else}
      <header class="page-head">
        <div class="eyebrow">Seal a capsule</div>
        <h1 class="page-title">写一枚胶囊</h1>
        <p class="page-lead">写给未来的自己，或者某个还没出现的人。合上之后，在开启时间到来之前，没有任何人能读到它。</p>
      </header>

      <div class="create">
        <form class="create__form card" novalidate {onsubmit}>
          <div class={["field", titleShake.on && "is-shake"]} data-field="title">
            <div class="field__head">
              <label class="field__label" for="title">标题 <em>*</em></label>
              <span class="field__count mono"><b>{Array.from(f.title).length}</b>/60</span>
            </div>
            <div class="input-wrap input-wrap--action">
              <input
                id="title"
                bind:this={titleEl}
                bind:value={f.title}
                class="input"
                autocomplete="off"
                placeholder="给这枚胶囊起个名字"
                data-testid="create-title"
                {@attach autofocus(380)}
              />
              <button
                class={["ai-btn", f.aiBusy && "is-busy"]}
                type="button"
                data-testid="ai-generate"
                title="让 AI 代写正文并建议开启时间；标题留空时会顺便起个标题"
                onclick={() => f.aiWrite()}
              >
                <AppIcon name="sparkle" />
                <span>{f.aiBusy ? "代笔中…" : f.aiDone ? "重新代笔" : "AI 代笔"}</span>
              </button>
            </div>
            <div class="field__error" role="alert" data-testid={f.errors.title ? "field-error" : undefined} data-field="title">{f.errors.title}</div>
          </div>

          <div class={["recos", !f.showRecos && "is-hidden"]} data-testid={f.showRecos ? "ai-reco" : undefined}>
            <div class="recos__in">
              <div class="recos__head">
                <span><AppIcon name="sparkle" />没有头绪？从一个灵感开始</span>
                <button class="link-btn" type="button" data-testid="reco-refresh" disabled={f.recoBusy || f.aiBusy} onclick={() => f.refreshRecos()}>
                  <AppIcon name="refresh" />
                  {f.recoBusy ? "换一批中…" : "换一批"}
                </button>
              </div>
              <div class="recos__list">
                {#each f.recos as r, i (r.title)}
                  <button class="reco" type="button" style:--i={i} data-testid="reco-chip" disabled={f.aiBusy} onclick={() => f.aiWrite(r.title)}>
                    <b>{r.title}</b>
                    <span>{r.hint}</span>
                    <em><AppIcon name="clock" />{fmt.span(r.openInDays * DAY)}后</em>
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <div class={["field", contentShake.on && "is-shake"]} data-field="content">
            <div class="field__head">
              <label class="field__label" for="content">内容 <em>*</em></label>
              <span class="field__count mono"><b>{fmt.num(contentLength)}</b>/5000</span>
            </div>
            <div class={["paper", { "is-ai": f.aiBusy, "is-thinking": f.aiThinking }]}>
              <textarea
                id="content"
                bind:this={contentEl}
                bind:value={f.content}
                class="paper__text"
                rows="9"
                placeholder={"在这里写下想交给未来的话。\n可以是此刻的天气、正在读的书、一个小小的约定，\n或者只是一句：嘿，你还好吗？"}
                data-testid="create-content"
              ></textarea>
              <div class="paper__think" aria-hidden="true"><i></i><i></i><i></i></div>
            </div>
            <div class="field__hint">
              {#if f.aiNote}<span class="ai-note"><AppIcon name="sparkle" />{f.aiNote}</span>{/if}
            </div>
            <div class="field__error" role="alert" data-testid={f.errors.content ? "field-error" : undefined} data-field="content">{f.errors.content}</div>
          </div>

          <div class={["field", openShake.on && "is-shake"]} data-field="openAt">
            <div class="field__head">
              <label class="field__label" for="openAt">开启时间 <em>*</em></label>
              <span class="field__count">最早 1 分钟后 · 最晚 10 年内</span>
            </div>
            <AmberDateTimePicker value={f.draft.openAt} onchange={(t) => f.setOpenAt(t)} />
            <div class="chips">
              {#each PRESETS as p (p.key)}
                <button
                  class={["chip", f.draft.preset === p.key && "is-active"]}
                  type="button"
                  data-testid="openat-preset"
                  data-preset={p.key}
                  data-value={p.key}
                  data-selected={f.draft.preset === p.key}
                  onclick={() => f.pickPreset(p.key)}
                >
                  {p.label}
                </button>
              {/each}
            </div>
            <div class="field__error" role="alert" data-testid={f.errors.openAt ? "field-error" : undefined} data-field="openAt">{f.errors.openAt}</div>
          </div>

          <label class={["toggle-card", f.inPlaza && "is-on"]}>
            <span class="toggle-card__ic"><AppIcon name="globe" /></span>
            <span class="toggle-card__txt">
              <b>发布到胶囊广场</b>
              <small>{f.inPlaza ? "标题与昵称公开展示，内容到时间才可见" : "不出现在广场；把胶囊码交给谁，谁才能找到它"}</small>
            </span>
            <input bind:checked={f.inPlaza} type="checkbox" class="sr-only" data-testid="create-in-plaza" />
            <span class="switch" aria-hidden="true"></span>
          </label>

          <div class="create__foot">
            <div class="create__sum">
              <AppIcon name="hourglass" />
              {#if span > 0}
                <span>将沉睡 <b>{fmt.span(span)}</b>，于 {fmt.full(f.draft.openAt)} 开启</span>
              {:else}
                <span>选一个开启的时刻</span>
              {/if}
            </div>
            <button class={["btn", "btn--primary", "btn--lg", f.submitting && "is-busy"]} type="submit" disabled={f.submitting} data-testid="create-submit">
              <AppIcon name="lock" />
              <span>{f.submitting ? "正在封存…" : "封存胶囊"}</span>
            </button>
          </div>
        </form>

        <aside class="create__side">
          <div class="preview card">
            <div class="preview__head">
              <span class="eyebrow">实时预览</span>
              <span class="badge badge--amber">尚未封存</span>
            </div>
            <div class="preview__art"><AmberCapsuleArt code={null} state="opened" width={220} /></div>
            <h3 class="preview__title">{f.title.trim() || "未命名的胶囊"}</h3>
            <div class="preview__by">
              <AppAvatar id={me.avatarId} />
              {me.nickname}
            </div>
            <dl class="preview__table">
              <div>
                <dt>开启时间</dt>
                <dd class="mono">{f.draft.openAtMissing ? "待选择" : dash(f.draft.openAt)}</dd>
              </div>
              <div>
                <dt>沉睡时长</dt>
                <dd>{span > 0 ? fmt.span(span) : "—"}</dd>
              </div>
              <div>
                <dt>正文</dt>
                <dd>{fmt.num(contentLength)} 字</dd>
              </div>
            </dl>
            <div class="badges">
              <AmberVisBadge inPlaza={f.inPlaza} />
              {#if span > 0}<AmberBadge kind="amber" icon="clock">{fmt.span(span)}后</AmberBadge>{/if}
            </div>
          </div>
          <ul class="notes">
            <li>
              <AppIcon name="key" />
              <span>封存后会得到一串 8 位胶囊码，它是开启胶囊的凭证，也能分享给别人。</span>
            </li>
            <li>
              <AppIcon name="lock" />
              <span>到开启时间之前，内容对所有人不可见——包括写下它的你。</span>
            </li>
            <li>
              <AppIcon name="trash" />
              <span>封存后，内容和开启时间都不能再修改；可以在「我创建的」里删除。</span>
            </li>
          </ul>
        </aside>
      </div>
    {/if}
  </div>
</div>
