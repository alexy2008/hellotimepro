<script lang="ts">
  import { link } from "svelte-routing";
  import { api } from "@/api/client";
  import { ApiError, type CapsuleDetail as CapsuleDetailT } from "@/types";
  import CapsuleDetail from "@/components/CapsuleDetail.svelte";
  import Alert from "@/components/Alert.svelte";

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  let cap = $state<CapsuleDetailT | null>(null);
  let err = $state<string | null>(null);
  let loading = $state(true);

  async function loadCapsule({ showLoading = true } = {}) {
    if (showLoading) loading = true;
    err = null;
    try {
      cap = await api.plazaById(id);
    } catch (e) {
      err = e instanceof ApiError ? e.message : "胶囊不存在";
    } finally {
      if (showLoading) loading = false;
    }
  }

  $effect(() => {
    // id 变化时重新加载
    id;
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
        <a href="/" use:link class="cy-btn cy-btn--ghost">返回广场</a>
      </div>
    </div>
  {/if}
</main>
