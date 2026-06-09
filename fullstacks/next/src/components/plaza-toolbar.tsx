"use client";

// 广场工具栏（客户端孤岛）：排序/筛选/搜索都改写 URL searchParams，由服务端组件
// 据此重新取数渲染。本身不持有列表数据。
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

function buildHref(next: { sort: PlazaSort; filter: PlazaFilter; q: string }) {
  const usp = new URLSearchParams();
  if (next.sort !== "new") usp.set("sort", next.sort);
  if (next.filter !== "all") usp.set("filter", next.filter);
  if (next.q) usp.set("q", next.q);
  const qs = usp.toString();
  return qs ? `/?${qs}` : "/";
}

export function PlazaToolbar({
  sort,
  filter,
  q,
}: {
  sort: PlazaSort;
  filter: PlazaFilter;
  q: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(q);
  const lastPushed = useRef(q);

  // URL 上的 q 变化（如返回/前进）时同步输入框。
  useEffect(() => {
    setDraft(q);
    lastPushed.current = q;
  }, [q]);

  // 搜索 300ms 防抖后改写 URL（重置到第一页）。
  useEffect(() => {
    if (draft === lastPushed.current) return;
    const t = window.setTimeout(() => {
      lastPushed.current = draft;
      router.push(buildHref({ sort, filter, q: draft }));
    }, 300);
    return () => window.clearTimeout(t);
  }, [draft, sort, filter, router]);

  return (
    <div className="cy-toolbar">
      <div className="cy-toolbar__group">
        <div className="cy-seg">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={s.key === sort ? "cy-seg__active" : ""}
              onClick={() => router.push(buildHref({ sort: s.key, filter, q: draft }))}
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
              onClick={() => router.push(buildHref({ sort, filter: f.key, q: draft }))}
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
