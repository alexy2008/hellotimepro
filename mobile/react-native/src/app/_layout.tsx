// 根布局：加载字体（Orbitron + Inter）、hydrate auth/theme、撑住 splash，
// 再渲染根 Stack（底部 Tab 组 + 详情/鉴权/关于/设置等栈屏）。

import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Orbitron_500Medium, Orbitron_700Bold } from "@expo-google-fonts/orbitron";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";
import { tokens } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbitron_500Medium,
    Orbitron_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const hydrateAuth = useAuth((s) => s.hydrate);
  const hydrateTheme = useTheme((s) => s.hydrate);
  const authHydrated = useAuth((s) => s.hydrated);
  const themeHydrated = useTheme((s) => s.hydrated);
  const mode = useTheme((s) => s.mode);

  useEffect(() => {
    void hydrateAuth();
    void hydrateTheme();
  }, [hydrateAuth, hydrateTheme]);

  const ready = fontsLoaded && authHydrated && themeHydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const pal = tokens.semantic[mode];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: pal.surface[0] },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="c/[code]" />
          <Stack.Screen name="about" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="login" options={{ presentation: "modal" }} />
          <Stack.Screen name="register" options={{ presentation: "modal" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
