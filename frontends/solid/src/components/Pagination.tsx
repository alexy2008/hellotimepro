// ============================================================
// 通用分页器：上一页 / 当前页 X / Y / 下一页
// ============================================================

import { Show } from "solid-js";

export function Pagination(props: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** 可选：在「第 X / Y 页」之后追加的尾部信息，如「共 N 条」 */
  extra?: string;
  /** 总页数 ≤ 1 时是否仍渲染（默认隐藏） */
  alwaysShow?: boolean;
  /** 上下外边距 */
  margin?: string;
}) {
  return (
    <Show when={(props.alwaysShow ?? false) || props.totalPages > 1}>
      <div
        style={{
          display: "flex",
          "justify-content": "center",
          "align-items": "center",
          gap: "var(--space-3)",
          margin: props.margin ?? "var(--space-8) 0",
        }}
      >
        <button
          type="button"
          class="cy-btn cy-btn--ghost cy-btn--sm"
          disabled={props.page <= 1}
          onClick={() => props.onChange(props.page - 1)}
        >
          上一页
        </button>
        <span
          style={{
            color: "var(--color-text-muted)",
            "font-size": "var(--font-size-sm)",
          }}
        >
          第 {props.page} / {props.totalPages} 页
          {props.extra ? ` · ${props.extra}` : ""}
        </span>
        <button
          type="button"
          class="cy-btn cy-btn--ghost cy-btn--sm"
          disabled={props.page >= props.totalPages}
          onClick={() => props.onChange(props.page + 1)}
        >
          下一页
        </button>
      </div>
    </Show>
  );
}
