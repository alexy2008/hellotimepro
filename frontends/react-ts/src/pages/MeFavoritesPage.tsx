import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination as PaginationT } from "@/types";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 15;

export function MeFavoritesPage() {
  const [items, setItems] = useState<CapsuleListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationT | null>(null);
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

      <Pagination
        page={page}
        totalPages={pagination?.totalPages ?? 0}
        onChange={setPage}
      />
    </>
  );
}
