<script lang="ts">
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperSeal from "./PaperSeal.svelte";
</script>

<div class="page">
  <div class="wrap wrap--narrow detail">
    <div class="lost" data-testid="not-found">
      <div class="lost__mark"><PaperSeal ch="迷" variant="line" /></div>
      <h1 class="h1">查无此页</h1>
      <p>
        这个地址没有对应的页面。
        <br />
        也许是链接抄错了一位，也许它从未存在过。
      </p>
      <div class="lost__act">
        <a class="btn btn--primary" href="/">回到广场</a>
        <a class="btn btn--ghost" href="/open"><AppIcon name="key" />凭码开启</a>
      </div>
    </div>
  </div>
</div>
