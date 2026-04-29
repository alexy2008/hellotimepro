import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination as PaginationT } from "@/types";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { Pagination } from "@/components/Pagination";
import { fmtNumber } from "@/utils/format";

const PAGE_SIZE = 15;

export function MeCreatedPage() {
  const [items, setItems] = useState<CapsuleListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationT | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .myCapsules(page, PAGE_SIZE)
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

  async function withdraw(id: string) {
    const sure = window.confirm("确认撤回？此操作不可恢复。");
    if (!sure) return;
    try {
      await api.deleteMyCapsule(id);
      setItems((arr) => arr.filter((c) => c.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "撤回失败");
    }
  }

  return (
    <>
      <h1>我创建的胶囊</h1>

      <div className="cy-toolbar" style={{ borderBottom: "none", paddingTop: 0 }}>
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          按创建时间倒序 · 共 {pagination?.total ?? 0} 条
        </span>
        <Link className="cy-btn cy-btn--primary cy-btn--sm" to="/create">
          + 新建胶囊
        </Link>
      </div>

      <CapsuleGrid
        items={items}
        loading={loading}
        showCreator={false}
        hideFavorite
        emptyHint={
          <div className="cy-empty">
            <div className="cy-empty__emoji">📭</div>
            <p>还没有创建任何胶囊</p>
            <Link className="cy-btn cy-btn--primary cy-btn--sm" to="/create" style={{ marginTop: "var(--space-3)" }}>
              去创建一个
            </Link>
          </div>
        }
        cardSlot={(c) =>
          c.isOpened ? (
            <span style={{ color: "var(--color-favorite-active)" }}>
              ♥ {fmtNumber(c.favoriteCount)}
            </span>
          ) : (
            <button
              type="button"
              className="cy-btn cy-btn--ghost cy-btn--sm"
              style={{ minHeight: 28, padding: "4px 12px", color: "var(--color-danger-fg)" }}
              onClick={() => withdraw(c.id)}
            >
              撤回
            </button>
          )
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
