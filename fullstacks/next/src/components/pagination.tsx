"use client";

// 通用分页器：上一页 / 第 X / Y 页 · 共 N 条 / 下一页
// 用法：
//   <Pagination
//     page={page}
//     totalPages={pagination?.totalPages ?? 0}
//     onChange={setPage}
//     extra={`共 ${pagination?.total ?? 0} 条`}
//   />

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** 可选：在「第 X / Y 页」之后追加的尾部信息，如「共 N 条」 */
  extra?: string;
  /** 总页数 ≤ 1 时是否仍渲染（默认隐藏） */
  alwaysShow?: boolean;
  /** 上下外边距 */
  margin?: string;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  extra,
  alwaysShow = false,
  margin = "var(--space-8) 0",
}: Props) {
  if (!alwaysShow && totalPages <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "var(--space-3)",
        margin,
      }}
    >
      <button
        type="button"
        className="cy-btn cy-btn--ghost cy-btn--sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </button>
      <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
        第 {page} / {totalPages} 页{extra ? ` · ${extra}` : ""}
      </span>
      <button
        type="button"
        className="cy-btn cy-btn--ghost cy-btn--sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
