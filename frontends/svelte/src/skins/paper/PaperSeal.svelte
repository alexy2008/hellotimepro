<!-- 印章：solid = 白文（朱底白字，表示「封」）；line = 朱文（朱框朱字，表示「启」） -->
<script lang="ts">
  let { ch, variant = "solid", class: cls = "" }: { ch: string; variant?: "solid" | "line"; class?: string } = $props();
</script>

<span class={["seal", `seal--${variant}`, cls]} aria-hidden="true">{ch}</span>
