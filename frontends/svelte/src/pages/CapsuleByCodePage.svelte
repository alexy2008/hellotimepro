<script lang="ts">
  import { link } from "svelte-routing";
  import { api } from "@/api/client";
  import { ApiError, type CapsuleDetail as CapsuleDetailT } from "@/types";
  import CapsuleDetail from "@/components/CapsuleDetail.svelte";
  import Alert from "@/components/Alert.svelte";

  interface Props {
    code: string;
  }

  let { code }: Props = $props();

  let cap = $state<CapsuleDetailT | null>(null);
  let err = $state<string | null>(null);
  let loading = $state(true);

  async function loadCapsule({ showLoading = true } = {}) {
    if (showLoading) loading = true;
    err = null;
    const c = String(code ?? "").toUpperCase();
    try {
      const fetched = await api.capsuleByCode(c);
      cap = fetched;
      return fetched;
    } catch (e) {
      err = e instanceof ApiError ? e.message : "胶囊不存在";
      return null;
    } finally {
      if (showLoading) loading = false;
    }
  }

  $effect(() => {
    void loadCapsule();
  });

  function onChange(c: CapsuleDetailT) {
    cap = c;
  }
</script>

<main class="cy-container">
  {#if loading}
    <div class="cy-empty"><p>加载中…</p></div>
  {:else if cap}
    <CapsuleDetail
      capsule={cap}
      {onChange}
      onExpired={() => loadCapsule({ showLoading: false })}
    />
  {:else}
    <div style:max-width="560px" style:margin="var(--space-12) auto">
      <Alert variant="danger">{err ?? "胶囊不存在"}</Alert>
      <div style:margin-top="var(--space-4)" style:text-align="center">
        <a href="/open" use:link class="cy-btn cy-btn--ghost">返回输入码</a>
      </div>
    </div>
  {/if}
</main>
