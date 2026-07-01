// 胶囊列表：移植自 frontends/react-ts/src/components/CapsuleGrid.tsx。
// 单列纵向（移动端），不用 FlatList——置于外层 ScrollView 中按页渲染（每页 15 条）。

import { type ReactNode } from "react";
import { View } from "react-native";
import type { CapsuleListItem } from "@/types";
import { space } from "@/theme";
import { CapsuleCard } from "./CapsuleCard";
import { T } from "./ui";

interface Props {
  items: CapsuleListItem[];
  loading?: boolean;
  emptyHint?: ReactNode;
  showCreator?: boolean;
  hideFavorite?: boolean;
  cardSlot?: (capsule: CapsuleListItem) => ReactNode;
}

export function CapsuleList({ items, loading, emptyHint, showCreator, hideFavorite, cardSlot }: Props) {
  if (loading && items.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: space[12], gap: space[2] }}>
        <T size={32}>⏳</T>
        <T tone="muted">加载中…</T>
      </View>
    );
  }
  if (!loading && items.length === 0) {
    return (
      <>
        {emptyHint ?? (
          <View style={{ alignItems: "center", paddingVertical: space[12] }}>
            <T tone="muted">暂无数据</T>
          </View>
        )}
      </>
    );
  }
  return (
    <View style={{ gap: space[3] }}>
      {items.map((c) => (
        <CapsuleCard
          key={c.id}
          capsule={c}
          showCreator={showCreator}
          hideFavorite={hideFavorite}
          rightSlot={cardSlot?.(c)}
        />
      ))}
    </View>
  );
}
