<!-- ============================================================
     「琥珀」开启页（/open）：8 格输码；登录后附「我封存过的胶囊」
     结构与类名照 2.0 原型 amber/view-capsule.js
     ============================================================ -->
<script lang="ts">
  import { authStore } from "@/stores/auth.svelte.ts";
  import { ms } from "@/lib/fmt";
  import { paletteOf } from "@/lib/palette";
  import { useCodeOpen } from "@/state/code-open.svelte.ts";
  import { MySealed } from "@/state/capsule.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AmberBadge from "./AmberBadge.svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import AmberCodeInput from "./AmberCodeInput.svelte";
  import { cdShort } from "./art";

  const o = useCodeOpen();
  const mine = new MySealed();
  const now = Date.now();

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void o.go(o.value);
  }
</script>

<div class="page page--open">
  <div class="container open">
    <header class="page-head page-head--center">
      <div class="eyebrow">Open a capsule</div>
      <h1 class="page-title">开启胶囊</h1>
      <p class="page-lead">输入 8 位胶囊码。到了开启时间，就能读到里面的话；还没到，就陪它一起倒数。</p>
    </header>
    <form class="open__form card" novalidate {onsubmit}>
      <AmberCodeInput size="lg" value={o.value} state={o.state} shake={o.shake} autofocus onchange={o.input} oncomplete={o.go} />
      <div class="open__err" role="alert" data-testid={o.error ? "open-error" : undefined}>{o.error}</div>
      <button class={["btn", "btn--primary", "btn--lg", o.state === "checking" && "is-busy"]} type="submit"><AppIcon name="key" />开启胶囊</button>
      <p class="open__hint">
        胶囊码由 8 位大写字母与数字组成，输入时不区分大小写，可直接粘贴。
        <br />
        没有发布到广场的胶囊，同样可以凭码开启。也可以直接访问 <code class="mono">/capsules/胶囊码</code>。
      </p>
    </form>
    {#if authStore.user && mine.items.length}
      <section class="open__list" data-testid="my-sealed">
        <header>
          <h2>我封存过的胶囊</h2>
          <a class="link-btn" href="/me/created">全部<AppIcon name="arrow" /></a>
        </header>
        <ul>
          {#each mine.items as c (c.id)}
            <li>
              <a
                class="crow"
                href={`/capsules/${c.code}`}
                style:--glow={paletteOf(c.code).glow}
                data-testid="my-sealed-item"
                data-code={c.code}
                data-state={c.isOpened ? "opened" : "sealed"}
              >
                <AmberCapsuleArt code={c.code} state={c.isOpened ? "opened" : "locked"} width={72} />
                <span class="crow__info">
                  <b>{c.title}</b>
                  <span class="mono">{c.code}</span>
                </span>
                {#if c.isOpened}
                  <AmberBadge kind="opened" icon="mail">已开启</AmberBadge>
                {:else}
                  <AmberBadge kind="locked" icon="lock">{cdShort(ms(c.openAt), now)} 后</AmberBadge>
                {/if}
                <AppIcon name="chev-right" class="crow__go" />
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
</div>
