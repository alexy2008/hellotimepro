<!-- 刻度尺：封存 → 启封 的等待进度（p 为百分比） -->
<script lang="ts">
  let { p, class: cls = "" }: { p: number; class?: string } = $props();
</script>

<div class={["scale", cls]} style:--p={`${p}%`}>
  <i class="scale__fill"></i>
  <i class="scale__mark"></i>
</div>
