// ============================================================
// 两套皮肤结构相同的小部件：头像、技术栈图标、皮肤切换开关、明暗开关、「加载更多」。
// 长相差异全在 spec/styles 里，这里只出标记。
// ============================================================

import { For, Show, createSignal, onCleanup } from "solid-js";
import { avatarOf } from "@/lib/avatars";
import { Icon } from "@/lib/icons";
import { SKIN_LABEL, setSkin, skin, toggleTheme, type Skin } from "@/stores/ui";
import { toast } from "@/stores/feedback";
import { api } from "@/api/client";
import type { HealthData, StackItem } from "@/types";

export function Avatar(props: { id: string | null | undefined; class?: string }) {
  const a = () => avatarOf(props.id);
  return (
    <span class={props.class ? `av ${props.class}` : "av"} style={{ "--av": a().color }} aria-hidden="true">
      <svg viewBox="0 0 24 24" innerHTML={a().glyph} />
    </span>
  );
}

/** 技术栈图标：有图就用后端托管的 SVG，没有就退成两个字 */
export function TechIcon(props: { item: Pick<StackItem, "name" | "iconUrl">; class: string }) {
  return (
    <Show
      when={props.item.iconUrl}
      fallback={
        <span class={`${props.class} ${props.class}--txt`} aria-hidden="true">
          {props.item.name.replace(/[^A-Za-z一-龥]/g, "").slice(0, 2)}
        </span>
      }
    >
      {(src) => <img class={props.class} src={src()} alt="" loading="lazy" />}
    </Show>
  );
}

/** 当前后端的 /health：页脚与关于页共用，只请求一次 */
let healthPromise: Promise<HealthData> | null = null;
export function createHealth() {
  const [health, setHealth] = createSignal<HealthData | null>(null);
  const [online, setOnline] = createSignal<boolean | null>(null);
  let alive = true;
  onCleanup(() => (alive = false));
  healthPromise ??= api.health();
  healthPromise
    .then((h) => {
      if (!alive) return;
      setHealth(h);
      setOnline(true);
    })
    .catch(() => {
      healthPromise = null;
      if (alive) setOnline(false);
    });
  const backend = () => health()?.stack.items ?? [];
  return {
    health,
    online,
    backend,
    /** 后端框架名：优先取 framework 角色 */
    backendName: () => backend().find((i) => i.role === "framework")?.name ?? backend()[0]?.name,
  };
}

/** 皮肤切换：一组两个单选项（两套皮肤长得不一样，结构相同） */
export function SkinSwitch() {
  const pick = (k: Skin) => {
    if (k === skin()) return;
    void setSkin(k).then(() => toast(`已切换到「${SKIN_LABEL[k]}」`));
  };
  return (
    <div class="skinsw" role="radiogroup" aria-label="界面皮肤">
      <For each={["paper", "amber"] as const}>
        {(k) => (
          <button
            type="button"
            role="radio"
            aria-checked={skin() === k}
            class={skin() === k ? "is-active" : ""}
            title={`切换到「${SKIN_LABEL[k]}」`}
            data-testid="skin-option"
            data-value={k}
            data-selected={String(skin() === k)}
            onClick={() => pick(k)}
          >
            {SKIN_LABEL[k]}
          </button>
        )}
      </For>
    </div>
  );
}

/** 明暗切换的点击处理：从点击位置晕开；键盘触发时从按钮中心晕开 */
export function onThemeClick(e: MouseEvent & { currentTarget: HTMLButtonElement }) {
  const r = e.currentTarget.getBoundingClientRect();
  const kb = e.clientX === 0 && e.clientY === 0;
  toggleTheme({ x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY });
}

/** 「我的」列表底部的「加载更多」：还有下一页时才出现（测试钩子 list-next） */
export function ListMore(props: { show: boolean; busy: boolean; left: number; onMore: () => void }) {
  return (
    <Show when={props.show}>
      <div class="list-more">
        <button
          class={`btn btn--ghost${props.busy ? " is-busy" : ""}`}
          type="button"
          disabled={props.busy}
          onClick={() => props.onMore()}
          data-testid="list-next"
        >
          {props.busy ? "加载中…" : `加载更多（还有 ${props.left} 枚）`}
        </button>
      </div>
    </Show>
  );
}

/** 「时笺」与「琥珀」的表单提示条：成功 / 失败 / 信息 */
export function FormMsg(props: { m: { type: string; text: string } | null }) {
  return (
    <div class={`form__msg${props.m ? " is-" + props.m.type : ""}`} role="status">
      <Show when={props.m}>
        {(m) => (
          <>
            <IconFor type={m().type} />
            <span>{m().text}</span>
          </>
        )}
      </Show>
    </div>
  );
}

function IconFor(props: { type: string }) {
  return <Icon name={props.type === "err" ? "alert" : props.type === "ok" ? "check" : "info"} />;
}
