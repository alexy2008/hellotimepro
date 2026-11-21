<!-- 线性图标：路径是 lib/icons.ts 里的常量，不含用户输入，可以放心 {@html}。
     class 并到 .ic 上（如 class="ic--go"） -->
<script lang="ts">
  import { ICONS, type IconName } from "@/lib/icons";

  let { name, class: cls = "" }: { name: IconName; class?: string } = $props();
</script>

<svg class={["ic", cls]} viewBox="0 0 24 24" aria-hidden="true">{@html ICONS[name]}</svg>
