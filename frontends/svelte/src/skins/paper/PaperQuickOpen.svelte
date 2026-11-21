<!-- 首页就地输码：与开启页同一个部件（X3），满 8 位自动查询 -->
<script lang="ts">
  import { useCodeOpen } from "@/state/code-open.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperCodeInput from "./PaperCodeInput.svelte";

  const o = useCodeOpen();

  function onsubmit(e: SubmitEvent) {
    e.preventDefault();
    void o.go(o.value);
  }
</script>

<form class={["hquick", o.value.length === 8 && "is-full"]} novalidate {onsubmit}>
  <div class="hquick__k"><AppIcon name="key" />已有胶囊码？在这里开启</div>
  <div class="hquick__row">
    <PaperCodeInput size="sm" value={o.value} state={o.state} shake={o.shake} onchange={o.input} oncomplete={o.go} />
    <button class="hquick__go" type="submit" aria-label="开启"><AppIcon name="arrow" /></button>
  </div>
  <div class="hquick__err" role="alert" data-testid={o.error ? "open-error" : undefined}>{o.error}</div>
</form>
