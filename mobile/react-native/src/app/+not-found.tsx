// 404：移植自 frontends/react-ts/src/pages/NotFoundPage.tsx。

import { useRouter } from "expo-router";
import { View } from "react-native";
import { fontSize, space } from "@/theme";
import { Button, Screen, T } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space[4], padding: space[6] }}>
        <T size={48}>🛸</T>
        <T display weight="700" size={fontSize["2xl"]}>
          页面走丢了
        </T>
        <T tone="muted" center>
          这条链接对应的页面不存在或已被移除。
        </T>
        <Button title="回到广场" onPress={() => router.replace("/")} />
      </View>
    </Screen>
  );
}
