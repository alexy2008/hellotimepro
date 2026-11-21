<!-- 年鉴的一格：数字进入视口时数上来（年份从今年数到目标年） -->
<script lang="ts">
  import { fmt } from "@/lib/fmt";
  import { countUp } from "@/lib/attach";

  let { k, n, a, b, plain = false }: { k: string; n: number; a: string; b: string; plain?: boolean } = $props();
</script>

<div class="almanac__cell" data-testid="stat" data-key={k} data-value={n}>
  <b class="latin" {@attach countUp(n, plain ? new Date().getFullYear() : 0, plain ? String : fmt.num)}></b>
  <span>{a}<br />{b}</span>
</div>
