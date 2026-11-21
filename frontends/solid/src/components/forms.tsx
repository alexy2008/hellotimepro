// ============================================================
// 表单小件：字段、密码眼睛、密码规则、昵称状态、头像选择。
// 两套皮肤结构相同、外框不同（时笺是下划线信笺栏，琥珀是带图标的输入框），
// 按当前皮肤出各自的标记，逻辑只写一份。
// ============================================================

import { For, Show, children, createEffect, createSignal, on, onCleanup, onMount, type JSX } from "solid-js";
import { focusIfIdle } from "@/lib/fmt";
import { skin } from "@/stores/ui";
import { Icon, type IconName } from "@/lib/icons";
import { avatarOf } from "@/lib/avatars";
import { pwdRules, type NickStateValue } from "@/lib/account";
import { Avatar } from "@/components/shared";
import { AvatarStamp } from "@/skins/paper/parts";

/**
 * 出错时抖一下：key 每变一次（错误文字出现或换了）就加 is-shake 480ms。
 * on(…, { defer: true }) 跳过挂载时那一次——换皮肤后新视图不会凭空抖。
 */
export function createShake(key: () => unknown) {
  const [on_, setOn] = createSignal(false);
  createEffect(
    on(
      key,
      (k) => {
        if (!k) return;
        setOn(true);
        const t = setTimeout(() => setOn(false), 480);
        onCleanup(() => clearTimeout(t));
      },
      { defer: true },
    ),
  );
  return () => (on_() ? " is-shake" : "");
}

export interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  hint?: string;
  error?: string;
  ok?: string;
  req?: boolean;
  /** 琥珀：输入框左侧的图标 */
  lead?: IconName;
  /** 输入框右侧的小部件（眼睛、昵称状态、锁） */
  trail?: JSX.Element;
  testId?: string;
  /** 出错时提示上的 data-field（测试钩子 field-error 用），默认取 id */
  errorKey?: string;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  inputType?: string;
  autoFocus?: boolean;
}

export function Field(p: FieldProps) {
  const shake = createShake(() => p.error);
  // JSX 类的 prop 每读一次就新建一次节点：用 children() 解析一次，判断与渲染共用
  const trail = children(() => p.trail);
  let ref: HTMLInputElement | undefined;
  onMount(() => {
    if (!p.autoFocus) return;
    const t = setTimeout(() => focusIfIdle(ref), 380);
    onCleanup(() => clearTimeout(t));
  });

  const input = () => (
    <input
      ref={ref}
      class={skin() === "paper" ? "field__input" : "input"}
      id={p.id}
      name={p.id}
      type={p.inputType ?? p.type ?? "text"}
      value={p.value}
      onInput={(e) => p.onChange?.(e.currentTarget.value)}
      autocomplete={p.autoComplete}
      placeholder={p.placeholder}
      maxLength={p.maxLength}
      disabled={p.disabled}
      aria-describedby={`${p.id}-hint`}
      aria-invalid={p.error ? true : undefined}
      data-testid={p.testId}
    />
  );
  const cls = () => `field${p.error ? " is-error" : p.ok ? " is-ok" : ""}`;
  const hint = () => (
    <div
      class="field__hint"
      id={`${p.id}-hint`}
      data-testid={p.error ? "field-error" : undefined}
      data-field={p.error ? (p.errorKey ?? p.id) : undefined}
    >
      {p.error || p.ok || p.hint}
    </div>
  );

  return (
    <Show
      when={skin() === "paper"}
      fallback={
        <div class={cls()} data-field={p.id}>
          <div class="field__head">
            <label class="field__label" for={p.id}>
              {p.label}
              <Show when={p.req}>
                <em> *</em>
              </Show>
            </label>
          </div>
          <div class={`input-wrap${p.lead ? " input-wrap--icon" : ""}${trail() ? " input-wrap--action" : ""}${shake()}`}>
            <Show when={p.lead}>{(lead) => <Icon name={lead()} class="input-wrap__icon" />}</Show>
            {input()}
            {trail()}
          </div>
          {hint()}
        </div>
      }
    >
      <div class={cls()} data-field={p.id}>
        <label class="field__label" for={p.id}>
          {p.label}
        </label>
        <div class={`field__box${shake()}`}>
          {input()}
          {trail()}
          <span class="field__line" />
        </div>
        {hint()}
      </div>
    </Show>
  );
}

/** 密码字段：右侧一只眼睛，点一下明文 / 密文切换 */
export function PasswordField(p: Omit<FieldProps, "trail" | "inputType">) {
  const [show, setShow] = createSignal(false);
  return (
    <Field
      {...p}
      inputType={show() ? "text" : "password"}
      trail={
        <button
          class={skin() === "paper" ? "field__eye" : "input-wrap__action icon-btn"}
          type="button"
          aria-label={show() ? "隐藏密码" : "显示密码"}
          onClick={() => setShow((v) => !v)}
        >
          <Icon name={show() ? "eye-off" : "eye"} />
        </button>
      }
    />
  );
}

/** 昵称右侧的状态点：格式通过打勾，不通过打叉 */
export function NickState(props: { state: NickStateValue }) {
  const good = () => props.state === "valid";
  const bad = () => props.state === "invalid" || props.state === "taken";
  return (
    <span
      class={`${skin() === "paper" ? "field__state" : "input-wrap__action nick-state"}${good() ? " is-good" : bad() ? " is-bad" : ""}`}
      aria-hidden="true"
      data-testid={props.state ? "nickname-state" : undefined}
      data-state={props.state || undefined}
    >
      <Show when={good()} fallback={<Show when={bad()}>{<Icon name="x" />}</Show>}>
        <Icon name="check" />
      </Show>
    </span>
  );
}

/** 密码规则：至少 8 位 / 含字母 / 含数字，满足的那条点亮 */
export function PwdRules(props: { value: string }) {
  const r = () => pwdRules(props.value);
  return (
    <ul class="rules" aria-hidden="true">
      <li class={r().len ? "is-ok" : ""}>至少 8 位</li>
      <li class={r().alpha ? "is-ok" : ""}>含字母</li>
      <li class={r().digit ? "is-ok" : ""}>含数字</li>
    </ul>
  );
}

const Cancel = () => (
  <svg class="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true">
    <circle cx="51" cy="65" r="14.5" />
    <circle cx="51" cy="65" r="10.5" />
    <path d="M45.5 65.5l4 4 7.5-8.5" />
  </svg>
);

/**
 * 头像选择：时笺是十枚邮票（选中的被盖上一枚带对勾的小邮戳），琥珀是十颗小星球。
 * 单选组：方向键在选项间移动。
 */
export function AvatarPicker(props: { ids: string[]; value: string; onChange: (id: string) => void }) {
  let box: HTMLDivElement | undefined;
  const cur = () => avatarOf(props.value);
  const move = (dir: number) => {
    const ids = props.ids;
    const i = Math.max(0, ids.indexOf(props.value));
    const n = ids[(i + dir + ids.length) % ids.length];
    props.onChange(n);
    requestAnimationFrame(() => box?.querySelector<HTMLElement>(`[data-value="${n}"]`)?.focus());
  };
  return (
    <>
      <div
        class="avpick"
        role="radiogroup"
        aria-label="选择头像"
        ref={box}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") (e.preventDefault(), move(1));
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") (e.preventDefault(), move(-1));
        }}
      >
        <For each={props.ids}>
          {(id) => {
            const a = avatarOf(id);
            const on = () => id === props.value;
            return (
              <button
                type="button"
                class={`avpick__it${on() ? " is-sel" : ""}`}
                role="radio"
                aria-checked={on()}
                tabIndex={on() ? 0 : -1}
                aria-label={`${a.name}，${a.tagline}`}
                data-testid="avatar-option"
                data-value={id}
                data-selected={String(on())}
                onClick={() => props.onChange(id)}
              >
                <Show
                  when={skin() === "paper"}
                  fallback={
                    <>
                      <Avatar id={id} class="av--xl" />
                      <span>{a.name}</span>
                    </>
                  }
                >
                  <AvatarStamp id={id} />
                  <Cancel />
                </Show>
              </button>
            );
          }}
        </For>
      </div>
      <div class="avpick__cap">
        <Show when={skin() === "amber"}>
          <Avatar id={cur().id} />
        </Show>
        <b>{cur().name}</b>
        <span>{cur().tagline}</span>
      </div>
    </>
  );
}
