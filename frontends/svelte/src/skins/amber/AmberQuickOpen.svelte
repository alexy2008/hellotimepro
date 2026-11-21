<!-- 首页就地输码：与开启页同一个部件（X3），满 8 位自动查询 -->
<script lang="ts">
  import { useCodeOpen } from "@/state/code-open.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AmberCodeInput from "./AmberCodeInput.svelte";

  const o = useCodeOpen();

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void o.go(o.value);
  }
</script>

<form class="quick card" novalidate {onsubmit}>
  <div class="quick__k"><AppIcon name="key" />已有胶囊码？在这里开启</div>
  <div class="quick__row">
    <AmberCodeInput size="md" value={o.value} state={o.state} shake={o.shake} onchange={o.input} oncomplete={o.go} />
    <button class="btn btn--soft" type="submit">开启<AppIcon name="arrow" /></button>
  </div>
  <div class="quick__err" role="alert" data-testid={o.error ? "open-error" : undefined}>{o.error}</div>
</form>
