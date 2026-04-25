import { useEffect, useState } from "react";
import { usePlaza } from "@/stores/plaza";
import type { PlazaFilter, PlazaSort } from "@/types";

const SORTS: Array<{ key: PlazaSort; label: string }> = [
  { key: "hot", label: "🔥 热门" },
  { key: "new", label: "✨ 最新" },
];

const FILTERS: Array<{ key: PlazaFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "opened", label: "已开启" },
  { key: "unopened", label: "未开启" },
];

export function PlazaToolbar() {
  const sort = usePlaza((s) => s.sort);
  const filter = usePlaza((s) => s.filter);
  const q = usePlaza((s) => s.q);
  const setSort = usePlaza((s) => s.setSort);
  const setFilter = usePlaza((s) => s.setFilter);
  const setQ = usePlaza((s) => s.setQ);

  // 300ms 防抖
  const [draft, setDraft] = useState(q);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (draft !== q) setQ(draft);
    }, 300);
    return () => window.clearTimeout(t);
  }, [draft, q, setQ]);

  return (
    <div className="cy-toolbar">
      <div className="cy-toolbar__group">
        <div className="cy-seg">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={s.key === sort ? "cy-seg__active" : ""}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="cy-seg">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={f.key === filter ? "cy-seg__active" : ""}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <label className="cy-search" aria-label="搜索胶囊">
        <span className="cy-search__icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          className="cy-search__input"
          placeholder="搜索标题或昵称…"
          maxLength={50}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
    </div>
  );
}
