import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useCapsule } from "@/stores/capsule";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { Pagination } from "@/components/Pagination";
import { fmtNumber } from "@/utils/format";

export function MeCreatedPage() {
  const { mine, fetchMine, deleteCapsule } = useCapsule();

  useEffect(() => {
    void fetchMine(1);
  }, [fetchMine]);

  async function withdraw(id: string) {
    const sure = window.confirm("确认撤回？此操作不可恢复。");
    if (!sure) return;
    try {
      await deleteCapsule(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "撤回失败");
    }
  }

  return (
    <>
      <h1>我创建的胶囊</h1>

      <div className="cy-toolbar" style={{ borderBottom: "none", paddingTop: 0 }}>
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          按创建时间倒序 · 共 {mine.pagination?.total ?? 0} 条
        </span>
        <Link className="cy-btn cy-btn--primary cy-btn--sm" to="/create">
          + 新建胶囊
        </Link>
      </div>

      <CapsuleGrid
        items={mine.items}
        loading={mine.loading}
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
        page={mine.page}
        totalPages={mine.pagination?.totalPages ?? 0}
        onChange={(p) => fetchMine(p)}
      />
    </>
  );
}
