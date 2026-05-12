"use client";

import type { Avatar } from "@/types";
import { avatarUrl } from "@/lib/avatar";

interface Props {
  avatars: Avatar[];
  value: string | null;
  onChange: (id: string) => void;
}

export function AvatarPicker({ avatars, value, onChange }: Props) {
  return (
    <div className="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
      {avatars.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          className={`cy-avatar-picker__item ${value === a.id ? "is-selected" : ""}`}
          onClick={() => onChange(a.id)}
          title={a.name}
        >
          <img src={a.svgUrl ?? avatarUrl(a.id)} alt={a.name} />
        </button>
      ))}
    </div>
  );
}
