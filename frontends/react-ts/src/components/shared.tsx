// ============================================================
// 两套皮肤结构相同的小部件：头像、技术栈图标、皮肤切换开关、明暗开关的状态。
// 长相差异全在 spec/styles 里，这里只出标记。
// ============================================================

import { useEffect, useState, type CSSProperties } from "react";
import { avatarOf } from "@/lib/avatars";
import { SKIN_LABEL, useUi, type Skin } from "@/stores/ui";
import { toast } from "@/stores/feedback";
import { api } from "@/api/client";
import type { HealthData, StackItem } from "@/types";
import { desktopStack } from "@/utils/desktop";

export function Avatar({ id, className }: { id: string | null | undefined; className?: string }) {
  const a = avatarOf(id);
  return (
    <span className={className ? `av ${className}` : "av"} style={{ "--av": a.color } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: a.glyph }} />
    </span>
  );
}

export const ROLE_LABEL: Record<string, string> = {
  language: "语言",
  framework: "框架",
  database: "数据库",
  orm: "ORM",
  runtime: "运行时",
  styling: "样式",
  build: "构建",
  state: "状态管理",
  "desktop-shell": "桌面壳",
  "desktop-runtime": "桌面运行时",
};

/** 技术栈图标：有图就用后端托管的 SVG，没有就退成两个字 */
export function TechIcon({ item, className }: { item: Pick<StackItem, "name" | "iconUrl">; className: string }) {
  return item.iconUrl ? (
    <img className={className} src={item.iconUrl} alt="" loading="lazy" />
  ) : (
    <span className={`${className} ${className}--txt`} aria-hidden="true">
      {item.name.replace(/[^A-Za-z一-龥]/g, "").slice(0, 2)}
    </span>
  );
}

/** 本前端自己的技术栈（页脚与关于页用）；被 Electron 内嵌时追加桌面壳 */
export const FRONTEND_STACK: StackItem[] = [
  ...desktopStack().map((d) => ({ role: d.role, name: d.name, version: "", iconUrl: d.iconUrl })),
  { role: "framework", name: "React", version: "19", iconUrl: "/static/icons/react.svg" },
  { role: "language", name: "TypeScript", version: "5.7", iconUrl: "/static/icons/typescript.svg" },
  { role: "build", name: "Vite", version: "6", iconUrl: null },
  { role: "state", name: "Zustand", version: "5", iconUrl: null },
];

/** 当前后端的 /health：页脚与关于页共用，只请求一次 */
let healthPromise: Promise<HealthData> | null = null;
export function useHealth() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    healthPromise ??= api.health();
    healthPromise
      .then((h) => alive && (setHealth(h), setOnline(true)))
      .catch(() => {
        healthPromise = null;
        if (alive) setOnline(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { health, online };
}

/** 皮肤切换：一组两个单选项（两套皮肤长得不一样，结构相同） */
export function SkinSwitch() {
  const skin = useUi((s) => s.skin);
  const setSkin = useUi((s) => s.setSkin);
  const pick = (k: Skin) => {
    if (k === skin) return;
    void setSkin(k).then(() => toast(`已切换到「${SKIN_LABEL[k]}」`));
  };
  return (
    <div className="skinsw" role="radiogroup" aria-label="界面皮肤">
      {(["paper", "amber"] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={skin === k}
          className={skin === k ? "is-active" : ""}
          title={`切换到「${SKIN_LABEL[k]}」`}
          data-testid="skin-option"
          data-value={k}
          data-selected={skin === k}
          onClick={() => pick(k)}
        >
          {SKIN_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

/** 明暗切换的点击处理：从点击位置晕开；键盘触发时从按钮中心晕开 */
export function useThemeToggle() {
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const kb = e.clientX === 0 && e.clientY === 0;
    toggleTheme({ x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY });
  };
  return { theme, onClick };
}
