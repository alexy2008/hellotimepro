// 底部 Tab Bar：广场 / 开启 / 创建 / 我的 —— 移动端核心 IA（对标 ui-prototype/mobile.html）。

import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { fonts, usePalette } from "@/theme";

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const pal = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: pal.signal.primary,
        tabBarInactiveTintColor: pal.text.muted,
        tabBarStyle: {
          backgroundColor: pal.surface[1],
          borderTopColor: pal.border.subtle,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: pal.surface[0] },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "广场",
          tabBarIcon: ({ color }) => <TabIcon glyph="⬢" color={color} />,
        }}
      />
      <Tabs.Screen
        name="open"
        options={{
          title: "开启",
          tabBarIcon: ({ color }) => <TabIcon glyph="⚿" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "创建",
          tabBarIcon: ({ color }) => <TabIcon glyph="✚" color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} />,
        }}
      />
    </Tabs>
  );
}
