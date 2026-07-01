// AI 推荐主题条：移植自 frontends/react-ts/src/components/RecommendationStrip.tsx。
// 三组主题色轮换的灵感标签 + 「换一批」。纯展示，数据/回填由创建页负责。

import { Pressable, View } from "react-native";
import type { CapsuleRecommendation } from "@/types";
import { fontSize, radius, space, usePalette } from "@/theme";
import { T } from "./ui";

const PALETTES = ["brand", "accent", "signal"] as const;

export function RecommendationStrip({
  recos,
  busy,
  disabled,
  onPick,
  onRefresh,
}: {
  recos: CapsuleRecommendation[];
  busy: boolean;
  disabled?: boolean;
  onPick: (reco: CapsuleRecommendation) => void;
  onRefresh: () => void;
}) {
  const pal = usePalette();
  const borderFor = (i: number) => {
    const p = PALETTES[i % PALETTES.length];
    return p === "brand" ? pal.brand.primary : p === "accent" ? pal.accent.primary : pal.signal.primary;
  };
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T size={fontSize.sm} weight="600" style={{ flex: 1 }}>
          ✨ 没有头绪？试试这些灵感
        </T>
        <Pressable onPress={onRefresh} disabled={busy || disabled} hitSlop={8}>
          <T tone="signal" size={fontSize.sm}>
            {busy ? "换一批中…" : "换一批"}
          </T>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {recos.map((reco, i) => (
          <Pressable
            key={reco.title}
            onPress={() => onPick(reco)}
            disabled={busy || disabled}
            style={{
              paddingHorizontal: space[3],
              paddingVertical: space[2],
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: borderFor(i),
              opacity: busy || disabled ? 0.5 : 1,
            }}
          >
            <T size={fontSize.sm}>{reco.title}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
