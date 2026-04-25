import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination } from "@/types";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { fmtNumber } from "@/utils/format";

type Tab = "all" | "sealed" | "opened";
const PAGE_SIZE = 15;

export function MeCreatedPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<CapsuleListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
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

  const filtered = useMemo(() => {
    if (tab === "sealed") return items.filter((c) => !c.isOpened);
    if (tab === "opened") return items.filter((c) => c.isOpened);
    return items;
  }, [items, tab]);

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

  const counts = useMemo(
    () => ({
      all: items.length,
      sealed: items.filter((c) => !c.isOpened).length,
      opened: items.filter((c) => c.isOpened).length,
    }),
    [items],
  );

  return (
    <>
      <h1>我创建的胶囊</h1>

      <div className="cy-toolbar" style={{ borderBottom: "none", paddingTop: 0 }}>
        <div className="cy-seg">
          <button type="button" className={tab === "all" ? "cy-seg__active" : ""} onClick={() => setTab("all")}>
            全部 {counts.all}
          </button>
          <button type="button" className={tab === "sealed" ? "cy-seg__active" : ""} onClick={() => setTab("sealed")}>
            未开启 {counts.sealed}
          </button>
          <button type="button" className={tab === "opened" ? "cy-seg__active" : ""} onClick={() => setTab("opened")}>
            已开启 {counts.opened}
          </button>
        </div>
        <Link className="cy-btn cy-btn--primary cy-btn--sm" to="/create">
          + 新建胶囊
        </Link>
      </div>

      <CapsuleGrid
        items={filtered}
        loading={loading}
        showCreator={false}
        hideFavorite
        emptyHint={
          <div className="cy-empty">
            <div className="cy-empty__emoji">📭</div>
            <p>{tab === "all" ? "还没有创建任何胶囊" : tab === "sealed" ? "没有未开启的胶囊" : "还没有已开启的胶囊"}</p>
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
