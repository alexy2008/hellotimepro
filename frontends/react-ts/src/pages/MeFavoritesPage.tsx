import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination } from "@/types";
import { CapsuleGrid } from "@/components/CapsuleGrid";

const PAGE_SIZE = 15;

export function MeFavoritesPage() {
  const [items, setItems] = useState<CapsuleListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .myFavorites(page, PAGE_SIZE)
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setPagination(r.pagination);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page]);

  return (
    <>
      <h1>我收藏的胶囊</h1>
      <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-6)" }}>
        共 {pagination?.total ?? 0} 条；取消收藏只会从此列表移除，不会影响原胶囊。
      </p>

      <CapsuleGrid
        items={items}
        loading={loading}
        emptyHint={
          <div className="cy-empty">
            <div className="cy-empty__emoji">🗂</div>
            <p>还没有收藏任何胶囊 —— 去广场看看？</p>
            <Link className="cy-btn cy-btn--ghost cy-btn--sm" to="/" style={{ marginTop: "var(--space-3)" }}>
              去广场
            </Link>
          </div>
        }
      />

      {pagination && pagination.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--space-3)",
            margin: "var(--space-8) 0",
          }}
        >
          <button
            type="button"
            className="cy-btn cy-btn--ghost cy-btn--sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </button>
          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
            第 {page} / {pagination.totalPages} 页
          </span>
          <button
            type="button"
            className="cy-btn cy-btn--ghost cy-btn--sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </>
  );
}
