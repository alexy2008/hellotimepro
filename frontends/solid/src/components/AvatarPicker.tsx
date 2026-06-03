import { For } from "solid-js";
import type { Avatar } from "@/types";
import { avatarUrl } from "@/utils/avatar";

export function AvatarPicker(props: {
  avatars: Avatar[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div class="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
      <For each={props.avatars}>
        {(a) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.value === a.id}
            class={`cy-avatar-picker__item ${props.value === a.id ? "is-selected" : ""}`}
            onClick={() => props.onChange(a.id)}
            title={a.name}
          >
            <img src={a.svgUrl ?? avatarUrl(a.id)} alt={a.name} />
          </button>
        )}
      </For>
    </div>
  );
}
