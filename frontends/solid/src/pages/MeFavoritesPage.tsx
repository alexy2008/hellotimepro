import { onMount } from "solid-js";
import { A } from "@solidjs/router";
import { capsule, fetchFavorites } from "@/stores/capsule";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { Pagination } from "@/components/Pagination";

export function MeFavoritesPage() {
  onMount(() => {
    void fetchFavorites(1);
  });

  return (
    <>
      <h1>我收藏的胶囊</h1>
      <p style={{ color: "var(--color-text-secondary)", margin: "0 0 var(--space-6)" }}>
        共 {capsule.favorites.pagination?.total ?? 0} 条；取消收藏只会从此列表移除，不会影响原胶囊。
      </p>

      <CapsuleGrid
        items={capsule.favorites.items}
        loading={capsule.favorites.loading}
        emptyHint={
          <div class="cy-empty">
            <div class="cy-empty__emoji">🗂</div>
            <p>还没有收藏任何胶囊 —— 去广场看看？</p>
            <A
              class="cy-btn cy-btn--ghost cy-btn--sm"
              href="/"
              style={{ "margin-top": "var(--space-3)" }}
            >
              去广场
            </A>
          </div>
        }
      />

      <Pagination
        page={capsule.favorites.page}
        totalPages={capsule.favorites.pagination?.totalPages ?? 0}
        onChange={(p) => fetchFavorites(p)}
      />
    </>
  );
}
