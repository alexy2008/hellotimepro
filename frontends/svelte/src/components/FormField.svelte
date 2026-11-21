<!-- ============================================================
     表单字段：两套皮肤结构相同、外框不同——
     时笺是下划线信笺栏，琥珀是带图标的输入框。逻辑只写一份。
     值用 bind:value；输入框右侧的小部件（眼睛、昵称状态、锁）走 trail 片段。
     出错时自带 field-error 测试钩子，并抖一下。
     ============================================================ -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { ui } from "@/stores/ui.svelte.ts";
  import { useShake } from "@/lib/motion.svelte.ts";
  import { autofocus as autofocusAttach } from "@/lib/attach";
  import AppIcon from "@/components/AppIcon.svelte";
  import type { FieldProps } from "@/components/field";

  let {
    value = $bindable(""),
    id,
    label,
    type = "text",
    inputType,
    hint,
    error,
    ok,
    req,
    lead,
    testId,
    errorKey,
    autocomplete,
    placeholder,
    maxlength,
    disabled,
    autofocus,
    oninput,
    trail,
  }: FieldProps & { value?: string; inputType?: string; oninput?: () => void; trail?: Snippet } = $props();

  const shake = useShake(() => error);
</script>

{#snippet input(cls: string)}
  <input
    bind:value
    class={cls}
    {id}
    name={id}
    type={inputType ?? type}
    {autocomplete}
    {placeholder}
    {maxlength}
    {disabled}
    aria-describedby={`${id}-hint`}
    aria-invalid={error ? true : undefined}
    data-testid={testId}
    {oninput}
    {@attach autofocus && autofocusAttach()}
  />
{/snippet}

<div class={["field", { "is-error": error, "is-ok": !error && ok }]} data-field={id}>
  {#if ui.skin === "paper"}
    <label class="field__label" for={id}>{label}</label>
    <div class={["field__box", shake.on && "is-shake"]}>
      {@render input("field__input")}
      {@render trail?.()}
      <span class="field__line"></span>
    </div>
  {:else}
    <div class="field__head">
      <label class="field__label" for={id}>{label}{#if req}<em> *</em>{/if}</label>
    </div>
    <div class={["input-wrap", { "input-wrap--icon": lead, "input-wrap--action": trail, "is-shake": shake.on }]}>
      {#if lead}<AppIcon name={lead} class="input-wrap__icon" />{/if}
      {@render input("input")}
      {@render trail?.()}
    </div>
  {/if}
  <div id={`${id}-hint`} class="field__hint" data-testid={error ? "field-error" : undefined} data-field={error ? (errorKey ?? id) : undefined}>
    {error || ok || hint}
  </div>
</div>
