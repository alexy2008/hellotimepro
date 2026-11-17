// ============================================================
// 表单小件：字段、密码眼睛、密码规则、昵称状态、头像选择。
// 两套皮肤结构相同、外框不同（时笺是下划线信笺栏，琥珀是带图标的输入框），
// 按当前皮肤出各自的标记，逻辑只写一份。
// ============================================================

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useUi } from "@/stores/ui";
import { Icon, type IconName } from "@/lib/icons";
import { avatarOf } from "@/lib/avatars";
import { pwdRules } from "@/hooks/useAccount";
import { Avatar } from "@/components/shared";
import { AvatarStamp } from "@/skins/paper/parts";

/** 出错时抖一下 */
function useShakeOn(error: string | undefined) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!error) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 480);
    return () => clearTimeout(t);
  }, [error]);
  return on ? " is-shake" : "";
}

interface FieldProps {
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
  trail?: ReactNode;
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
  const skin = useUi((s) => s.skin);
  const shake = useShakeOn(p.error);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!p.autoFocus) return;
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 380);
    return () => clearTimeout(t);
  }, [p.autoFocus]);

  const input = (
    <input
      ref={ref}
      className={skin === "paper" ? "field__input" : "input"}
      id={p.id}
      name={p.id}
      type={p.inputType ?? p.type ?? "text"}
      value={p.value}
      onChange={(e) => p.onChange?.(e.target.value)}
      autoComplete={p.autoComplete}
      placeholder={p.placeholder}
      maxLength={p.maxLength}
      disabled={p.disabled}
      aria-describedby={`${p.id}-hint`}
      aria-invalid={p.error ? true : undefined}
      data-testid={p.testId}
    />
  );
  const cls = `field${p.error ? " is-error" : p.ok ? " is-ok" : ""}`;
  const hint = (
    <div
      className="field__hint"
      id={`${p.id}-hint`}
      data-testid={p.error ? "field-error" : undefined}
      data-field={p.error ? p.errorKey ?? p.id : undefined}
    >
      {p.error || p.ok || p.hint}
    </div>
  );

  if (skin === "paper") {
    return (
      <div className={cls} data-field={p.id}>
        <label className="field__label" htmlFor={p.id}>
          {p.label}
        </label>
        <div className={`field__box${shake}`}>
          {input}
          {p.trail}
          <span className="field__line" />
        </div>
        {hint}
      </div>
    );
  }
  return (
    <div className={cls} data-field={p.id}>
      <div className="field__head">
        <label className="field__label" htmlFor={p.id}>
          {p.label}
          {p.req ? <em> *</em> : null}
        </label>
      </div>
      <div className={`input-wrap${p.lead ? " input-wrap--icon" : ""}${p.trail ? " input-wrap--action" : ""}${shake}`}>
        {p.lead ? <Icon name={p.lead} className="input-wrap__icon" /> : null}
        {input}
        {p.trail}
      </div>
      {hint}
    </div>
  );
}

/** 密码字段：右侧一只眼睛，点一下明文 / 密文切换 */
export function PasswordField(p: Omit<FieldProps, "trail" | "inputType">) {
  const skin = useUi((s) => s.skin);
  const [show, setShow] = useState(false);
  return (
    <Field
      {...p}
      inputType={show ? "text" : "password"}
      trail={
        <button
          className={skin === "paper" ? "field__eye" : "input-wrap__action icon-btn"}
          type="button"
          aria-label={show ? "隐藏密码" : "显示密码"}
          onClick={() => setShow((v) => !v)}
        >
          <Icon name={show ? "eye-off" : "eye"} />
        </button>
      }
    />
  );
}

/** 昵称右侧的状态点：格式通过打勾，不通过打叉 */
export function NickState({ state }: { state: "" | "valid" | "invalid" | "taken" }) {
  const skin = useUi((s) => s.skin);
  const good = state === "valid";
  const bad = state === "invalid" || state === "taken";
  const base = skin === "paper" ? "field__state" : "input-wrap__action nick-state";
  return (
    <span className={`${base}${good ? " is-good" : bad ? " is-bad" : ""}`} aria-hidden="true" data-testid={state ? "nickname-state" : undefined} data-state={state || undefined}>
      {good ? <Icon name="check" /> : bad ? <Icon name="x" /> : null}
    </span>
  );
}

/** 密码规则：至少 8 位 / 含字母 / 含数字，满足的那条点亮 */
export function PwdRules({ value }: { value: string }) {
  const r = pwdRules(value);
  return (
    <ul className="rules" aria-hidden="true">
      <li className={r.len ? "is-ok" : ""}>至少 8 位</li>
      <li className={r.alpha ? "is-ok" : ""}>含字母</li>
      <li className={r.digit ? "is-ok" : ""}>含数字</li>
    </ul>
  );
}

const CANCEL = (
  <svg className="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true">
    <circle cx="51" cy="65" r="14.5" />
    <circle cx="51" cy="65" r="10.5" />
    <path d="M45.5 65.5l4 4 7.5-8.5" />
  </svg>
);

/**
 * 头像选择：时笺是十枚邮票（选中的被盖上一枚带对勾的小邮戳），琥珀是十颗小星球。
 * 单选组：方向键在选项间移动。
 */
export function AvatarPicker({ ids, value, onChange }: { ids: string[]; value: string; onChange: (id: string) => void }) {
  const skin = useUi((s) => s.skin);
  const box = useRef<HTMLDivElement>(null);
  const cur = avatarOf(value);
  const move = (dir: number) => {
    const i = Math.max(0, ids.indexOf(value));
    const n = ids[(i + dir + ids.length) % ids.length];
    onChange(n);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-value="${n}"]`)?.focus());
  };
  return (
    <>
      <div
        className="avpick"
        role="radiogroup"
        aria-label="选择头像"
        ref={box}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") (e.preventDefault(), move(1));
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") (e.preventDefault(), move(-1));
        }}
      >
        {ids.map((id) => {
          const a = avatarOf(id);
          const on = id === value;
          return (
            <button
              key={id}
              type="button"
              className={`avpick__it${on ? " is-sel" : ""}`}
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              aria-label={`${a.name}，${a.tagline}`}
              data-testid="avatar-option"
              data-value={id}
              data-selected={on}
              onClick={() => onChange(id)}
            >
              {skin === "paper" ? (
                <>
                  <AvatarStamp id={id} />
                  {CANCEL}
                </>
              ) : (
                <>
                  <Avatar id={id} className="av--xl" />
                  <span>{a.name}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="avpick__cap">
        {skin === "amber" ? <Avatar id={cur.id} /> : null}
        <b>{cur.name}</b>
        <span>{cur.tagline}</span>
      </div>
    </>
  );
}
