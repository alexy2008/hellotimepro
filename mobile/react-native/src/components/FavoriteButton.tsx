// 收藏按钮：移植自 frontends/react-ts/src/components/FavoriteButton.tsx。
// 差异：window.confirm → RN Alert.alert；导航用 expo-router。

import { useEffect, useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/stores/auth";
import { usePlaza } from "@/stores/plaza";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail, type CapsuleListItem } from "@/types";
import { fonts, fontSize, radius, space, usePalette } from "@/theme";

interface Props {
  capsule: Pick<CapsuleListItem | CapsuleDetail, "id" | "favoritedByMe" | "favoriteCount">;
  size?: "sm" | "md";
  onChange?: (favorited: boolean, count: number) => void;
}

export function FavoriteButton({ capsule, size = "sm", onChange }: Props) {
  const pal = usePalette();
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const patchPlaza = usePlaza((s) => s.patchFavorited);

  const [active, setActive] = useState(capsule.favoritedByMe);
  const [count, setCount] = useState(capsule.favoriteCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActive(capsule.favoritedByMe);
    setCount(capsule.favoriteCount);
  }, [capsule.id, capsule.favoritedByMe, capsule.favoriteCount]);

  async function toggle() {
    if (!user) {
      Alert.alert("需要登录", "登录后才能收藏，前往登录？", [
        { text: "取消", style: "cancel" },
        { text: "去登录", onPress: () => router.push("/login") },
      ]);
      return;
    }
    setBusy(true);
    try {
      if (active) {
        await api.unfavorite(capsule.id);
        const next = Math.max(0, count - 1);
        setActive(false);
        setCount(next);
        patchPlaza(capsule.id, false, next);
        onChange?.(false, next);
      } else {
        const r = await api.favorite(capsule.id);
        setActive(true);
        setCount(r.favoriteCount);
        patchPlaza(capsule.id, true, r.favoriteCount);
        onChange?.(true, r.favoriteCount);
      }
    } catch (e) {
      Alert.alert("操作失败", e instanceof ApiError ? e.message : "请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  const heart = active ? "♥" : "♡";
  const heartColor = active ? pal.favorite.active : pal.favorite.inactive;

  if (size === "md") {
    return (
      <Pressable
        onPress={toggle}
        disabled={busy}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          paddingHorizontal: space[3],
          height: 44,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: active ? pal.accent.primary : pal.border.default,
          backgroundColor: pal.surface[2],
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Text style={{ color: heartColor, fontSize: fontSize.lg }}>{heart}</Text>
        <Text style={{ color: pal.text.primary, fontFamily: fonts.sansSemibold, fontSize: fontSize.sm }}>
          收藏 · {count}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[1],
        opacity: busy ? 0.6 : 1,
      }}
      hitSlop={8}
    >
      <Text style={{ color: heartColor, fontSize: fontSize.base }}>{heart}</Text>
      <Text style={{ color: pal.text.muted, fontSize: fontSize.sm, fontFamily: fonts.sans }}>{count}</Text>
    </Pressable>
  );
}
