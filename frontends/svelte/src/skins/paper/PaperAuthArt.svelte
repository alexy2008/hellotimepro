<!-- 登录 / 注册 共用的左侧题字：两句诗、出处、一枚印、一个邮戳 -->
<script lang="ts">
  import { fmt } from "@/lib/fmt";
  import PaperLogo from "./PaperLogo.svelte";
  import PaperPostmark from "./PaperPostmark.svelte";
  import PaperSeal from "./PaperSeal.svelte";

  let { poem, src, seal }: { poem: string[]; src: string; seal: string } = $props();
  const today = fmt.date(Date.now());
</script>

<aside class="auth__art" aria-hidden="true">
  <div class="auth__brand">
    <PaperLogo />
    <span class="latin">HelloTime</span>
  </div>
  <div class="auth__poem serif">
    {#each poem as l (l)}<span>{l}</span>{/each}
  </div>
  <div class="auth__foot">
    <span>{src}</span>
    <PaperSeal ch={seal} class="auth__seal" />
  </div>
  <div class="auth__pm">
    <PaperPostmark line1={today} line2="此 刻" class="pm--auth" />
  </div>
</aside>
