// 我的：合并 frontends/react-ts 的 MeCreated / MeFavorites + 资料汇总（移动 hub）。
// 资料卡（头像/昵称/邮箱 + 设置/登出）+ 我创建的/我收藏的 分段 + 列表 + 分页。门禁。

import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/stores/auth";
import { useCapsule } from "@/stores/capsule";
import { fmtNumber } from "@/utils/format";
import { fontSize, radius, space, usePalette } from "@/theme";
import { Button, Card, Screen, T } from "@/components/ui";
import { ScreenHeader, ThemeToggle } from "@/components/chrome";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/media";
import { CapsuleList } from "@/components/CapsuleList";
import { Pagination } from "@/components/Pagination";

type Tab = "created" | "favorites";

function MeHub() {
  const pal = usePalette();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const mine = useCapsule((s) => s.mine);
  const favorites = useCapsule((s) => s.favorites);
  const fetchMine = useCapsule((s) => s.fetchMine);
  const fetchFavorites = useCapsule((s) => s.fetchFavorites);
  const deleteCapsule = useCapsule((s) => s.deleteCapsule);

  const [tab, setTab] = useState<Tab>("created");

  useEffect(() => {
    if (tab === "created") void fetchMine(1);
    else void fetchFavorites(1);
  }, [tab, fetchMine, fetchFavorites]);

  function withdraw(id: string) {
    Alert.alert("撤回胶囊", "确认撤回？此操作不可恢复。", [
      { text: "取消", style: "cancel" },
      {
        text: "撤回",
        style: "destructive",
        onPress: () => {
          deleteCapsule(id).catch((e) =>
            Alert.alert("撤回失败", e instanceof Error ? e.message : "请稍后重试"),
          );
        },
      },
    ]);
  }

  function doLogout() {
    Alert.alert("登出", "确认登出当前账号？", [
      { text: "取消", style: "cancel" },
      {
        text: "登出",
        style: "destructive",
        onPress: () => {
          void logout().then(() => router.replace("/"));
        },
      },
    ]);
  }

  const slice = tab === "created" ? mine : favorites;

  return (
    <Screen>
      <ScreenHeader title="我的空间" right={<ThemeToggle />} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[16] }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Avatar avatarId={user?.avatarId} size={56} />
          <View style={{ flex: 1 }}>
            <T weight="700" size={fontSize.lg}>
              {user?.nickname ?? "—"}
            </T>
            <T tone="muted" size={fontSize.sm}>
              {user?.email ?? ""}
            </T>
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Button title="账号设置" variant="ghost" onPress={() => router.push("/settings")} style={{ flex: 1 }} />
          <Button title="登出" variant="danger" onPress={doLogout} style={{ flex: 1 }} />
        </View>

        <View
          style={{
            flexDirection: "row",
            backgroundColor: pal.surface[2],
            borderRadius: radius.md,
            padding: 3,
            gap: 3,
          }}
        >
          {(
            [
              { key: "created", label: "💾 我创建的" },
              { key: "favorites", label: "♥ 我收藏的" },
            ] as Array<{ key: Tab; label: string }>
          ).map((t) => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  flex: 1,
                  paddingVertical: space[2],
                  borderRadius: radius.sm,
                  backgroundColor: active ? pal.brand.primary : "transparent",
                  alignItems: "center",
                }}
              >
                <T size={fontSize.sm} style={{ color: active ? pal.brand.on : pal.text.secondary }} weight="600">
                  {t.label}
                </T>
              </Pressable>
            );
          })}
        </View>

        <T tone="muted" size={fontSize.sm}>
          共 {slice.pagination?.total ?? 0} 条
        </T>

        {tab === "created" ? (
          <CapsuleList
            items={mine.items}
            loading={mine.loading}
            showCreator={false}
            hideFavorite
            emptyHint={
              <View style={{ alignItems: "center", paddingVertical: space[10], gap: space[3] }}>
                <T size={36}>📭</T>
                <T tone="muted">还没有创建任何胶囊</T>
                <Button title="去创建一个" size="sm" onPress={() => router.push("/create")} />
              </View>
            }
            cardSlot={(c) =>
              c.isOpened ? (
                <T style={{ color: pal.favorite.active }}>♥ {fmtNumber(c.favoriteCount)}</T>
              ) : (
                <Button title="撤回" variant="danger" size="sm" onPress={() => withdraw(c.id)} />
              )
            }
          />
        ) : (
          <CapsuleList
            items={favorites.items}
            loading={favorites.loading}
            emptyHint={
              <View style={{ alignItems: "center", paddingVertical: space[10], gap: space[3] }}>
                <T size={36}>🗂</T>
                <T tone="muted">还没有收藏任何胶囊 —— 去广场看看？</T>
                <Button title="去广场" variant="ghost" size="sm" onPress={() => router.push("/")} />
              </View>
            }
          />
        )}

        <Pagination
          page={slice.page}
          totalPages={slice.pagination?.totalPages ?? 0}
          onChange={(p) => (tab === "created" ? fetchMine(p) : fetchFavorites(p))}
        />
      </ScrollView>
    </Screen>
  );
}

export default function MeScreen() {
  return (
    <AuthGate>
      <MeHub />
    </AuthGate>
  );
}
