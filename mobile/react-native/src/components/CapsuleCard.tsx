// 胶囊卡片：移植自 frontends/react-ts/src/components/CapsuleCard.tsx。
// 整卡可点开（→ /c/:code）；未开启卡片每秒刷新倒计时。

import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { CapsuleListItem } from "@/types";
import { countdownTo, fmtDate, fmtNumber } from "@/utils/format";
import { fontSize, radius, space, usePalette } from "@/theme";
import { T } from "./ui";
import { Avatar } from "./media";
import { Badge } from "./ui";
import { FavoriteButton } from "./FavoriteButton";

interface Props {
  capsule: CapsuleListItem;
  showCreator?: boolean;
  rightSlot?: ReactNode;
  hideFavorite?: boolean;
}

export function CapsuleCard({ capsule, showCreator = true, rightSlot, hideFavorite = false }: Props) {
  const pal = usePalette();
  const router = useRouter();
  const opened = capsule.isOpened;

  const [, setTick] = useState(0);
  useEffect(() => {
    if (opened) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [opened]);

  const cd = countdownTo(capsule.openAt);
  const accent = opened ? pal.capsule.opened.border : pal.capsule.sealed.border;

  return (
    <Pressable
      onPress={() => router.push(`/c/${capsule.code}`)}
      style={{
        backgroundColor: pal.surface[1],
        borderColor: pal.border.subtle,
        borderLeftColor: accent,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderRadius: radius.lg,
        padding: space[4],
        gap: space[2],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Badge label={opened ? "已开启" : "未开启"} kind={opened ? "opened" : "sealed"} />
        <T tone="signal" size={fontSize.sm} mono>
          {capsule.code}
        </T>
      </View>

      <T weight="600" size={fontSize.lg} numberOfLines={2}>
        {capsule.title}
      </T>

      {!opened ? (
        <T tone="secondary" size={fontSize.sm}>
          ⏳ 还剩 {fmtNumber(cd.days)} 天 · {String(cd.hours).padStart(2, "0")}:
          {String(cd.minutes).padStart(2, "0")}:{String(cd.seconds).padStart(2, "0")}
        </T>
      ) : capsule.contentPreview ? (
        <T tone="muted" size={fontSize.sm} numberOfLines={2}>
          {capsule.contentPreview}
        </T>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: space[1],
        }}
      >
        {showCreator ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Avatar avatarId={capsule.creator.avatarId} size={24} />
            <T tone="muted" size={fontSize.sm}>
              {capsule.creator.nickname}
            </T>
          </View>
        ) : (
          <T tone="muted" size={fontSize.sm}>
            创建于 {fmtDate(capsule.createdAt)}
          </T>
        )}
        {rightSlot ?? (!hideFavorite && <FavoriteButton capsule={capsule} />)}
      </View>
    </Pressable>
  );
}
