"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCapsuleStore } from "@/stores/capsule-store";
import { CapsuleGrid } from "@/components/capsule-grid";
import { Pagination } from "@/components/pagination";

export default function MeFavoritesPage() {
  const favorites = useCapsuleStore((s) => s.favorites);
  const fetchFavorites = useCapsuleStore((s) => s.fetchFavorites);

  useEffect(() => {
    void fetchFavorites(1);
  }, [fetchFavorites]);

  return (
    <>
      <h1>我收藏的胶囊</h1>
      <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-6)" }}>
        共 {favorites.pagination?.total ?? 0} 条；取消收藏只会从此列表移除，不会影响原胶囊。
      </p>

      <CapsuleGrid
        items={favorites.items}
        loading={favorites.loading}
        emptyHint={
          <div className="cy-empty">
            <div className="cy-empty__emoji">🗂</div>
            <p>还没有收藏任何胶囊 —— 去广场看看？</p>
            <Link
              className="cy-btn cy-btn--ghost cy-btn--sm"
              href="/"
              style={{ marginTop: "var(--space-3)" }}
            >
              去广场
            </Link>
          </div>
        }
      />

      <Pagination
        page={favorites.page}
        totalPages={favorites.pagination?.totalPages ?? 0}
        onChange={(p) => fetchFavorites(p)}
      />
    </>
  );
}
