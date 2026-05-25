<script lang="ts">
  import type { Avatar } from "@/types";
  import { avatarUrl } from "@/utils/avatar";

  interface Props {
    avatars: Avatar[];
    /** 受双向绑定的 avatarId（可为 null 表示未选） */
    value: string | null;
    onChange: (id: string) => void;
  }

  let { avatars, value, onChange }: Props = $props();
</script>

<div class="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
  {#each avatars as a (a.id)}
    <button
      type="button"
      role="radio"
      aria-checked={value === a.id}
      class={["cy-avatar-picker__item", value === a.id ? "is-selected" : ""].join(" ")}
      title={a.name}
      onclick={() => onChange(a.id)}
    >
      <img src={a.svgUrl ?? avatarUrl(a.id)} alt={a.name} />
    </button>
  {/each}
</div>
