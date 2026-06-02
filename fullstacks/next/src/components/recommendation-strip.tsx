"use client";

import type { CSSProperties } from "react";
import type { CapsuleRecommendation } from "@/types";

// 三组主题色，按下标轮换；文字默认色、无填充，仅用主色勾一道圆角边框做点缀（全取自设计 token）
const PALETTES = ["brand", "accent", "signal"] as const;

function chipStyle(index: number): CSSProperties {
  const p = PALETTES[index % PALETTES.length];
  return {
    whiteSpace: "nowrap",
    border: `1px solid var(--color-${p}-primary)`,
    borderRadius: "var(--radius-full)",
  };
}

// 创建页"AI 推荐主题"区域：仅在拿到推荐数据后由父组件渲染。
export function RecommendationStrip({
  recos,
  busy,
  disabled,
  onPick,
  onRefresh,
}: {
  recos: CapsuleRecommendation[];
  busy: boolean;
  disabled?: boolean;
  onPick: (reco: CapsuleRecommendation) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="cy-field">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <label style={{ margin: 0 }}>✨ 没有头绪？试试这些灵感</label>
        <button
          type="button"
          className="cy-btn cy-btn--ghost cy-btn--sm"
          onClick={onRefresh}
          disabled={busy || disabled}
          data-testid="reco-refresh"
          style={{ marginLeft: "auto" }}
        >
          {busy ? "换一批中…" : "换一批"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {recos.map((reco, i) => (
          <button
            key={reco.title}
            type="button"
            className="cy-btn cy-btn--ghost cy-btn--sm"
            onClick={() => onPick(reco)}
            disabled={busy || disabled}
            title={reco.hint}
            data-testid="reco-chip"
            style={chipStyle(i)}
          >
            {reco.title}
          </button>
        ))}
      </div>
    </div>
  );
}
