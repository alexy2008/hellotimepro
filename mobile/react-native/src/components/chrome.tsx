// 屏幕顶部 chrome：标题栏 + 主题切换。
// 移动端无持久页眉/页脚（底部 Tab Bar 取代顶部 nav），每屏自带标题区。

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@/stores/theme";
import { fontSize, space } from "@/theme";
import { T } from "./ui";

export function ThemeToggle() {
  const mode = useTheme((s) => s.mode);
  const toggle = useTheme((s) => s.toggle);
  return (
    <Pressable onPress={toggle} hitSlop={10}>
      <T size={20}>{mode === "dark" ? "☾" : "☀"}</T>
    </Pressable>
  );
}

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space[4],
        paddingTop: space[2],
        paddingBottom: space[3],
      }}
    >
      <T display weight="700" size={fontSize["2xl"]}>
        {title}
      </T>
      <View style={{ flexDirection: "row", gap: space[4], alignItems: "center" }}>{right}</View>
    </View>
  );
}
