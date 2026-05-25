<script lang="ts">
  import { navigate } from "svelte-routing";
  import CapsuleCodeInput from "@/components/CapsuleCodeInput.svelte";
  import Alert from "@/components/Alert.svelte";
  import { api } from "@/api/client";
  import { ApiError } from "@/types";

  let code = $state("");
  let err = $state<string | null>(null);
  let busy = $state(false);

  async function open(c: string) {
    if (c.length !== 8) return;
    err = null;
    busy = true;
    try {
      const cap = await api.capsuleByCode(c);
      navigate(`/capsules/${cap.code}`);
    } catch (e) {
      err = e instanceof ApiError ? e.message : "找不到这条胶囊";
    } finally {
      busy = false;
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      const filtered = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      code = filtered;
      if (filtered.length === 8) void open(filtered);
    } catch {
      err = "粘贴失败：请允许浏览器访问剪贴板";
    }
  }
</script>

<main class="cy-container">
  <div class="cy-open-center">
    <h1>用 8 位密钥开启胶囊</h1>
    <p>输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。</p>

    <div style:margin-bottom="var(--space-8)">
      <CapsuleCodeInput
        value={code}
        onInput={(v) => (code = v)}
        onComplete={open}
      />
    </div>

    <div
      style:display="flex"
      style:gap="var(--space-3)"
      style:justify-content="center"
      style:flex-wrap="wrap"
    >
      <button
        class="cy-btn cy-btn--primary cy-btn--lg"
        disabled={busy || code.length !== 8}
        onclick={() => open(code)}
      >
        {busy ? "查询中…" : "开启 →"}
      </button>
      <button class="cy-btn cy-btn--ghost cy-btn--lg" onclick={paste}>
        粘贴识别
      </button>
    </div>

    <div
      style:margin-top="var(--space-10)"
      style:color="var(--color-text-muted)"
      style:font-size="var(--font-size-sm)"
    >
      <div
        style:display="flex"
        style:gap="var(--space-4)"
        style:justify-content="center"
        style:flex-wrap="wrap"
      >
        <span>
          💡 可用
          <code style:background="var(--color-surface-2)" style:padding="2px 6px" style:border-radius="var(--radius-sm)">
            /capsules/&lt;code&gt;
          </code>
          直链访问
        </span>
        <span>🔒 未到开启时间的胶囊也会显示倒计时</span>
      </div>
    </div>
  </div>

  {#if err}
    <div style:max-width="560px" style:margin="0 auto">
      <Alert variant="danger">{err}</Alert>
    </div>
  {/if}
</main>
