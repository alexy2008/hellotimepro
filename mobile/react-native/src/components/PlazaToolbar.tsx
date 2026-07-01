// 广场工具条：移植自 frontends/react-ts/src/components/PlazaToolbar.tsx。
// 排序（热门/最新）+ 开启状态筛选 + 300ms 防抖搜索。

import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { usePlaza } from "@/stores/plaza";
import type { PlazaFilter, PlazaSort } from "@/types";
import { fonts, fontSize, radius, space, usePalette } from "@/theme";
import { T } from "./ui";

const SORTS: Array<{ key: PlazaSort; label: string }> = [
  { key: "hot", label: "🔥 热门" },
  { key: "new", label: "✨ 最新" },
];
const FILTERS: Array<{ key: PlazaFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "opened", label: "已开启" },
  { key: "unopened", label: "未开启" },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const pal = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: pal.surface[2],
        borderRadius: radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: space[2],
              borderRadius: radius.sm,
              backgroundColor: active ? pal.brand.primary : "transparent",
              alignItems: "center",
            }}
          >
            <T
              size={fontSize.sm}
              style={{
                color: active ? pal.brand.on : pal.text.secondary,
                fontFamily: active ? fonts.sansSemibold : fonts.sans,
              }}
            >
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PlazaToolbar() {
  const pal = usePalette();
  const sort = usePlaza((s) => s.sort);
  const filter = usePlaza((s) => s.filter);
  const q = usePlaza((s) => s.q);
  const setSort = usePlaza((s) => s.setSort);
  const setFilter = usePlaza((s) => s.setFilter);
  const setQ = usePlaza((s) => s.setQ);

  const [draft, setDraft] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== q) setQ(draft);
    }, 300);
    return () => clearTimeout(t);
  }, [draft, q, setQ]);

  return (
    <View style={{ gap: space[3] }}>
      <Segmented options={SORTS} value={sort} onChange={setSort} />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          backgroundColor: pal.surface[3],
          borderColor: pal.border.default,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
        }}
      >
        <T tone="muted">🔍</T>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="搜索标题或昵称…"
          placeholderTextColor={pal.text.muted}
          maxLength={50}
          style={{
            flex: 1,
            color: pal.text.primary,
            fontFamily: fonts.sans,
            fontSize: fontSize.base,
            paddingVertical: space[3],
          }}
        />
      </View>
    </View>
  );
}
