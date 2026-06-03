import { For, type JSX } from "solid-js";
import type { CapsuleRecommendation } from "@/types";

// 三组主题色，按下标轮换，让灵感标签更有表现力（全部取自设计 token）
const PALETTES = ["brand", "accent", "signal"] as const;

function chipStyle(index: number): JSX.CSSProperties {
  const p = PALETTES[index % PALETTES.length];
  // 文字保持默认色、无填充；仅用主色勾一道圆角边框做点缀
  return {
    "white-space": "nowrap",
    border: `1px solid var(--color-${p}-primary)`,
    "border-radius": "var(--radius-full)",
  };
}

// 创建页"AI 推荐主题"区域：仅在拿到推荐数据后由父组件渲染。
// 纯展示组件，数据与回填逻辑由 CreatePage 负责。
export function RecommendationStrip(props: {
  recos: CapsuleRecommendation[];
  busy: boolean;
  disabled?: boolean;
  onPick: (reco: CapsuleRecommendation) => void;
  onRefresh: () => void;
}) {
  return (
    <div class="cy-field">
      <div style={{ display: "flex", "align-items": "center", gap: "var(--space-2)" }}>
        <label style={{ margin: "0" }}>✨ 没有头绪？试试这些灵感</label>
        <button
          type="button"
          class="cy-btn cy-btn--ghost cy-btn--sm"
          onClick={() => props.onRefresh()}
          disabled={props.busy || props.disabled}
          data-testid="reco-refresh"
          style={{ "margin-left": "auto" }}
        >
          {props.busy ? "换一批中…" : "换一批"}
        </button>
      </div>

      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "var(--space-2)" }}>
        <For each={props.recos}>
          {(reco, i) => (
            <button
              type="button"
              class="cy-btn cy-btn--ghost cy-btn--sm"
              onClick={() => props.onPick(reco)}
              disabled={props.busy || props.disabled}
              title={reco.hint}
              data-testid="reco-chip"
              style={chipStyle(i())}
            >
              {reco.title}
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
