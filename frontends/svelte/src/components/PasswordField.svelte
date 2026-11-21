<!-- 密码字段：右侧一只眼睛，点一下明文 / 密文切换 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import FormField from "@/components/FormField.svelte";
  import AppIcon from "@/components/AppIcon.svelte";
  import type { FieldProps } from "@/components/field";

  let { value = $bindable(""), ...rest }: FieldProps & { value?: string; oninput?: () => void } = $props();
  let show = $state(false);
</script>

<FormField {...rest} bind:value inputType={show ? "text" : "password"}>
  {#snippet trail()}
    <button
      class={ui.skin === "paper" ? "field__eye" : "input-wrap__action icon-btn"}
      type="button"
      aria-label={show ? "隐藏密码" : "显示密码"}
      onclick={() => (show = !show)}
    >
      <AppIcon name={show ? "eye-off" : "eye"} />
    </button>
  {/snippet}
</FormField>
