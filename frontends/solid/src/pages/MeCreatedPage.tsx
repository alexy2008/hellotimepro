import { onMount } from "solid-js";
import { A } from "@solidjs/router";
import { capsule, fetchMine, deleteCapsule } from "@/stores/capsule";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { Pagination } from "@/components/Pagination";
import { fmtNumber } from "@/utils/format";

export function MeCreatedPage() {
  onMount(() => {
    void fetchMine(1);
  });

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

      <div class="cy-toolbar" style={{ "border-bottom": "none", "padding-top": "0" }}>
        <span
          style={{
            color: "var(--color-text-muted)",
            "font-size": "var(--font-size-sm)",
          }}
        >
          按创建时间倒序 · 共 {capsule.mine.pagination?.total ?? 0} 条
        </span>
        <A class="cy-btn cy-btn--primary cy-btn--sm" href="/create">
          + 新建胶囊
        </A>
      </div>

      <CapsuleGrid
        items={capsule.mine.items}
        loading={capsule.mine.loading}
        showCreator={false}
        hideFavorite={true}
        emptyHint={
          <div class="cy-empty">
            <div class="cy-empty__emoji">📭</div>
            <p>还没有创建任何胶囊</p>
            <A
              class="cy-btn cy-btn--primary cy-btn--sm"
              href="/create"
              style={{ "margin-top": "var(--space-3)" }}
            >
              去创建一个
            </A>
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
              class="cy-btn cy-btn--ghost cy-btn--sm"
              style={{
                "min-height": "28px",
                padding: "4px 12px",
                color: "var(--color-danger-fg)",
              }}
              onClick={() => withdraw(c.id)}
            >
              撤回
            </button>
          )
        }
      />

      <Pagination
        page={capsule.mine.page}
        totalPages={capsule.mine.pagination?.totalPages ?? 0}
        onChange={(p) => fetchMine(p)}
      />
    </>
  );
}
