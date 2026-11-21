<!-- ============================================================
     「时笺」开启页（/open）：8 格输码 + 粘贴识别；登录后附「我封存过的胶囊」
     结构与类名照 2.0 原型 paper/view-capsule.js
     ============================================================ -->
<script lang="ts">
  import { authStore } from "@/stores/auth.svelte.ts";
  import { toast } from "@/stores/feedback.svelte.ts";
  import { fmt, ms } from "@/lib/fmt";
  import { isCompleteCode, useCodeOpen } from "@/state/code-open.svelte.ts";
  import { MySealed } from "@/state/capsule.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperCodeInput from "./PaperCodeInput.svelte";
  import PaperSeal from "./PaperSeal.svelte";

  const o = useCodeOpen();
  const mine = new MySealed();
  let input = $state<PaperCodeInput>();
  const now = Date.now();

  async function pasteCode() {
    try {
      const t = (await navigator.clipboard.readText()).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!t) return toast("剪贴板里没有胶囊码", { tone: "info" });
      input?.set(t);
    } catch {
      toast("粘贴失败：请允许浏览器访问剪贴板", { tone: "error" });
    }
  }
</script>

<div class="page page--open">
  <div class="wrap openp">
    <div class="openp__poem" aria-hidden="true">
      <span>云中谁寄锦书来</span>
      <i></i>
      <small>李清照 ·《一剪梅》</small>
    </div>
    <section class="openp__main">
      <div class="overline"><i></i>Open a capsule</div>
      <h1 class="h1">凭码开启</h1>
      <p class="lede">
        输入朋友分享给你的 8 位胶囊码。
        <br />
        如果还没到启封的时刻，你会看到它的倒计时。
      </p>

      <PaperCodeInput bind:this={input} id="code" value={o.value} state={o.state} shake={o.shake} autofocus onchange={o.input} oncomplete={o.go} />
      <div class="openp__err" role="alert" data-testid={o.error ? "open-error" : undefined}>{o.error}</div>

      <div class="openp__act">
        <button
          class={["btn", "btn--primary", "btn--lg", o.state === "checking" && "is-busy"]}
          type="button"
          disabled={!isCompleteCode(o.value) || o.state === "checking"}
          onclick={() => o.go(o.value)}
        >
          <AppIcon name="key" />
          <span>开启</span>
          <AppIcon name="arrow" class="ic--go" />
        </button>
        <button class="btn btn--ghost btn--lg" type="button" onclick={pasteCode}><AppIcon name="paste" />粘贴识别</button>
      </div>

      <ul class="openp__tips">
        <li>
          <AppIcon name="link" />
          <span>也可以直接访问 <code class="mono">/capsules/&lt;胶囊码&gt;</code></span>
        </li>
        <li>
          <AppIcon name="lock" />
          <span>没有发布到广场的胶囊，同样可以凭码开启</span>
        </li>
      </ul>

      {#if authStore.user && mine.items.length}
        <section class="mylist" data-testid="my-sealed">
          <header>
            <h2 class="serif">我封存过的胶囊</h2>
            <a class="link" href="/me/created">全部<AppIcon name="arrow" /></a>
          </header>
          <ul>
            {#each mine.items as c (c.id)}
              <li>
                <a class="mylist__row" href={`/capsules/${c.code}`} data-testid="my-sealed-item" data-code={c.code} data-state={c.isOpened ? "opened" : "sealed"}>
                  <PaperSeal ch={c.isOpened ? "启" : "封"} variant={c.isOpened ? "line" : "solid"} />
                  <span class="mylist__info">
                    <b class="serif">{c.title}</b>
                    <span class="mono">{c.code}</span>
                  </span>
                  <span class="mylist__st">{c.isOpened ? "已开启" : "距启封 " + fmt.span(ms(c.openAt) - now)}</span>
                  <AppIcon name="chev-right" />
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </section>
  </div>
</div>
