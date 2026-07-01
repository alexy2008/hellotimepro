// 远端 SVG 渲染（头像 / 技术栈图标），复用后端 /static 真实资源——
// 与 desktop/swiftui「复用后端真实 SVG，不自造头像」一致。

import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { SvgUri } from "react-native-svg";
import { avatarUrl } from "@/utils/avatar";
import { fonts, usePalette } from "@/theme";
import { Text } from "react-native";

export function RemoteSvg({
  uri,
  size,
  style,
}: {
  uri: string;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <SvgUri uri={uri} width={size} height={size} />
    </View>
  );
}

export function Avatar({
  avatarId,
  size = 32,
}: {
  avatarId: string | undefined | null;
  size?: number;
}) {
  const pal = usePalette();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: pal.surface[2],
      }}
    >
      <SvgUri uri={avatarUrl(avatarId)} width={size} height={size} />
    </View>
  );
}

// 品牌字标：HelloTime + PRO（PRO 用信号青）。
export function BrandMark({ size = 20 }: { size?: number }) {
  const pal = usePalette();
  return (
    <Text style={{ fontFamily: fonts.display, fontSize: size, color: pal.text.primary }}>
      HelloTime<Text style={{ color: pal.signal.primary }}>PRO</Text>
    </Text>
  );
}
