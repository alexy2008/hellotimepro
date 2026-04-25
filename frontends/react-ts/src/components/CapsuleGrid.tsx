import { CapsuleCard } from "./CapsuleCard";
import type { CapsuleListItem } from "@/types";

interface Props {
  items: CapsuleListItem[];
  loading?: boolean;
  emptyHint?: React.ReactNode;
  showCreator?: boolean;
  hideFavorite?: boolean;
  cardSlot?: (capsule: CapsuleListItem) => React.ReactNode;
}

export function CapsuleGrid({
  items,
  loading,
  emptyHint,
  showCreator,
  hideFavorite,
  cardSlot,
}: Props) {
  if (loading && items.length === 0) {
    return (
      <div className="cy-empty">
        <div className="cy-empty__emoji">⏳</div>
        <p>加载中…</p>
      </div>
    );
  }
  if (!loading && items.length === 0) {
    return <>{emptyHint ?? <div className="cy-empty"><p>暂无数据</p></div>}</>;
  }

  return (
    <div className="cy-grid">
      {items.map((c) => (
        <CapsuleCard
          key={c.id}
          capsule={c}
          showCreator={showCreator}
          hideFavorite={hideFavorite}
          rightSlot={cardSlot?.(c)}
        />
      ))}
    </div>
  );
}
