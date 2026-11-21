<!-- 登录 / 注册卡片顶上的小景：一枚在轨道上缓缓转动的胶囊 -->
<script lang="ts">
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";

  let { state: artState }: { state: "locked" | "opened" } = $props();
</script>

<div class="auth__art" aria-hidden="true">
  <span class="auth__orbit"></span>
  <span class="auth__orbit auth__orbit--2"></span>
  <AmberCapsuleArt code={null} state={artState} width={180} />
</div>
