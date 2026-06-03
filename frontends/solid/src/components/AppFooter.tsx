import { createSignal, onMount, For, Show } from "solid-js";
import { api } from "@/api/client";
import type { HealthData } from "@/types";

const FRONTEND_ITEMS = [
  { role: "frontend-framework", name: "SolidJS", iconUrl: "/static/icons/solidjs.svg" },
  { role: "frontend-language", name: "TypeScript", iconUrl: "/static/icons/typescript.svg" },
  { role: "frontend-styling", name: "Tailwind CSS", iconUrl: "/static/icons/tailwindcss.svg" },
];

export function AppFooter() {
  const [health, setHealth] = createSignal<HealthData | null>(null);
  const [connected, setConnected] = createSignal<boolean | null>(null);

  onMount(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        setConnected(true);
      })
      .catch(() => setConnected(false));
  });

  const dotClass = () =>
    connected() === true
      ? "cy-backend-dot cy-backend-dot--online"
      : connected() === false
        ? "cy-backend-dot cy-backend-dot--offline"
        : "cy-backend-dot";

  return (
    <footer class="cy-footer">
      <div class="cy-container cy-footer__inner">
        <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
          © 2026 HelloTime Pro
          <span
            class={dotClass()}
            title={
              connected() === true
                ? "后端在线"
                : connected() === false
                  ? "后端离线"
                  : "连接中…"
            }
          />
        </div>
        <div class="cy-stack">
          <For each={FRONTEND_ITEMS}>
            {(it) => (
              <span class="cy-stack__item" title={it.role}>
                <img src={it.iconUrl} alt="" />
                {it.name}
              </span>
            )}
          </For>
          <For each={health()?.stack.items ?? []}>
            {(it) => (
              <span class="cy-stack__item" title={it.role}>
                <Show when={it.iconUrl}>
                  <img src={it.iconUrl!} alt="" />
                </Show>
                {it.name}
              </span>
            )}
          </For>
        </div>
      </div>
    </footer>
  );
}
