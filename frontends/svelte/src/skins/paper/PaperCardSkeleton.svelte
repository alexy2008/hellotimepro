<script lang="ts">
  let { i }: { i: number } = $props();
</script>

<div class="cap cap--skel" style:--i={i} aria-hidden="true">
  <i class="sk sk--a"></i>
  <i class="sk sk--b"></i>
  <i class="sk sk--c"></i>
  <i class="sk sk--c2"></i>
  <i class="sk sk--d"></i>
</div>
