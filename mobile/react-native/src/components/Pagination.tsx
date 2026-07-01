// 分页器：移植自 frontends/react-ts/src/components/Pagination.tsx。

import { View } from "react-native";
import { fontSize, space } from "@/theme";
import { Button, T } from "./ui";

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  extra?: string;
  alwaysShow?: boolean;
}

export function Pagination({ page, totalPages, onChange, extra, alwaysShow = false }: Props) {
  if (!alwaysShow && totalPages <= 1) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: space[3],
        marginVertical: space[8],
      }}
    >
      <Button
        title="上一页"
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
      />
      <T tone="muted" size={fontSize.sm}>
        第 {page} / {totalPages} 页{extra ? ` · ${extra}` : ""}
      </T>
      <Button
        title="下一页"
        variant="ghost"
        size="sm"
        disabled={page >= totalPages}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}
