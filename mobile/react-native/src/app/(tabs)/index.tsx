// 广场：移植自 frontends/react-ts/src/pages/PlazaPage.tsx（移动布局）。
// 紧凑 hero + 工具条（排序/筛选/搜索）+ 胶囊流 + 分页。

import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { usePlaza } from "@/stores/plaza";
import { useAuth } from "@/stores/auth";
import { fmtNumber } from "@/utils/format";
import { fontSize, radius, space, usePalette } from "@/theme";
import { Button, Card, T } from "@/components/ui";
import { ScreenHeader, ThemeToggle } from "@/components/chrome";
import { Screen } from "@/components/ui";
import { PlazaToolbar } from "@/components/PlazaToolbar";
import { CapsuleList } from "@/components/CapsuleList";
import { Pagination } from "@/components/Pagination";

export default function PlazaScreen() {
  const pal = usePalette();
  const router = useRouter();

  const fetchPlaza = usePlaza((s) => s.fetch);
  const items = usePlaza((s) => s.items);
  const loading = usePlaza((s) => s.loading);
  const pagination = usePlaza((s) => s.pagination);
  const page = usePlaza((s) => s.page);
  const setPage = usePlaza((s) => s.setPage);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    void fetchPlaza();
  }, [fetchPlaza]);

  return (
    <Screen>
      <ScreenHeader
        title="胶囊广场"
        right={
          <>
            <Pressable onPress={() => router.push("/about")} hitSlop={10}>
              <T tone="muted" size={20}>
                ⓘ
              </T>
            </Pressable>
            <ThemeToggle />
          </>
        }
      />
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[16], gap: space[4] }}>
        <Card glowColor={pal.plaza.glow} style={{ gap: space[3] }}>
          <T display weight="700" size={fontSize["2xl"]}>
            封存此刻 <T display weight="700" size={fontSize["2xl"]} tone="accent">开启未来</T>
          </T>
          <T tone="secondary" size={fontSize.sm}>
            写下此刻最真实的想法，设定一个解封时刻——时间到了，它才会被打开。
          </T>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button title="创建胶囊" onPress={() => router.push(user ? "/create" : "/register")} style={{ flex: 1 }} />
            <Button title="用码开启" variant="success" onPress={() => router.push("/open")} style={{ flex: 1 }} />
          </View>
        </Card>

        <PlazaToolbar />

        <CapsuleList
          items={items}
          loading={loading}
          emptyHint={
            <View style={{ alignItems: "center", paddingVertical: space[12], gap: space[3] }}>
              <T size={36}>🌌</T>
              <T tone="muted" center>
                广场暂无胶囊 —— 来当第一个写信给未来的人？
              </T>
              <Button
                title={user ? "创建胶囊" : "注册并创建"}
                size="sm"
                onPress={() => router.push(user ? "/create" : "/register")}
              />
            </View>
          }
        />

        <Pagination
          page={page}
          totalPages={pagination?.totalPages ?? 0}
          onChange={setPage}
          extra={pagination ? `共 ${fmtNumber(pagination.total)} 条` : undefined}
        />
      </ScrollView>
    </Screen>
  );
}
