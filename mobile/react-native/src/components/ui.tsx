// ============================================================
// 通用 UI 基元：把设计令牌包成 RN 组件，供各屏复用。
// 对标 Web 端 cyber.css 的 .cy-* 类，但用原生组件 + StyleSheet 重建。
// ============================================================

import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, fontSize, radius, space, usePalette } from "@/theme";

// ---------- 文本 ----------
type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "brand"
  | "signal"
  | "accent"
  | "success"
  | "danger";

export function T({
  children,
  tone = "primary",
  size = fontSize.base,
  weight = "400",
  display,
  mono,
  center,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  tone?: TextTone;
  size?: number;
  weight?: "400" | "500" | "600" | "700";
  display?: boolean;
  mono?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const pal = usePalette();
  const toneColor: Record<TextTone, string> = {
    primary: pal.text.primary,
    secondary: pal.text.secondary,
    muted: pal.text.muted,
    brand: pal.brand.primary,
    signal: pal.signal.primary,
    accent: pal.accent.primary,
    success: pal.success.fg,
    danger: pal.danger.fg,
  };
  const family = display
    ? weight === "500"
      ? fonts.displayMedium
      : fonts.display
    : mono
      ? fonts.mono
      : weight === "700"
        ? fonts.sansBold
        : weight === "600"
          ? fonts.sansSemibold
          : weight === "500"
            ? fonts.sansMedium
            : fonts.sans;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: toneColor[tone], fontSize: size, fontFamily: family },
        center && { textAlign: "center" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------- 屏幕容器 ----------
export function Screen({
  children,
  scroll,
  edges = ["top", "left", "right"],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const pal = usePalette();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: pal.surface[0] }]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// ---------- 卡片 ----------
export function Card({
  children,
  style,
  glowColor,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  glowColor?: string;
}) {
  const pal = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: pal.surface[1],
          borderColor: pal.border.subtle,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: space[5],
        },
        glowColor && {
          shadowColor: glowColor,
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------- 按钮 ----------
export type ButtonVariant = "primary" | "success" | "ghost" | "danger";
export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  left,
  style,
  full,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  left?: ReactNode;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  testID?: string;
}) {
  const pal = usePalette();
  const height = size === "sm" ? 34 : size === "lg" ? 52 : 44;
  const padH = size === "sm" ? space[3] : space[5];
  const fs = size === "sm" ? fontSize.sm : fontSize.base;
  const isGradient = variant === "primary" || variant === "success";
  const gradColors: [string, string, string] =
    variant === "success"
      ? [pal.success.solid, pal.capsule.opened.accent, pal.success.solid]
      : [pal.brand.primary, pal.signal.primary, pal.brand.primary];

  const inner = (
    <View style={[styles.row, { gap: space[2] }]}>
      {loading ? (
        <ActivityIndicator size="small" color={isGradient ? pal.brand.on : pal.text.primary} />
      ) : (
        left
      )}
      <Text
        style={{
          color: isGradient
            ? pal.brand.on
            : variant === "danger"
              ? pal.danger.fg
              : pal.text.primary,
          fontSize: fs,
          fontFamily: fonts.sansSemibold,
        }}
      >
        {title}
      </Text>
    </View>
  );

  const base: ViewStyle = {
    height,
    paddingHorizontal: padH,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled || loading ? 0.55 : 1,
  };

  if (isGradient) {
    return (
      <Pressable testID={testID} onPress={onPress} disabled={disabled || loading} style={[full && styles.full, style]}>
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[base, full && styles.full]}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        base,
        {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: variant === "danger" ? pal.danger.border : pal.border.default,
          backgroundColor: pal.surface[2],
        },
        full && styles.full,
        style,
      ]}
    >
      {inner}
    </Pressable>
  );
}

// ---------- 徽标 ----------
export function Badge({
  label,
  kind,
}: {
  label: string;
  kind: "opened" | "sealed" | "plaza";
}) {
  const pal = usePalette();
  const map = {
    opened: { fg: pal.capsule.opened.accent, border: pal.capsule.opened.border },
    sealed: { fg: pal.capsule.sealed.accent, border: pal.capsule.sealed.border },
    plaza: { fg: pal.brand.hover, border: pal.brand.primary },
  }[kind];
  return (
    <View
      style={{
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radius.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: map.border,
      }}
    >
      <Text style={{ color: map.fg, fontSize: fontSize.xs, fontFamily: fonts.sansSemibold }}>
        {label}
      </Text>
    </View>
  );
}

// ---------- 提示条 ----------
export function Alert({
  variant = "info",
  children,
  style,
}: {
  variant?: "info" | "success" | "danger";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const pal = usePalette();
  const map = {
    info: { bg: pal.surface[2], fg: pal.text.secondary, border: pal.border.default, icon: "ⓘ" },
    success: { bg: pal.success.bg, fg: pal.success.fg, border: pal.success.border, icon: "✓" },
    danger: { bg: pal.danger.bg, fg: pal.danger.fg, border: pal.danger.border, icon: "⚠" },
  }[variant];
  return (
    <View
      style={[
        {
          flexDirection: "row",
          gap: space[2],
          backgroundColor: map.bg,
          borderColor: map.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: space[3],
        },
        style,
      ]}
    >
      <Text style={{ color: map.fg }}>{map.icon}</Text>
      <Text style={{ color: map.fg, flex: 1, fontSize: fontSize.sm, fontFamily: fonts.sans }}>
        {children}
      </Text>
    </View>
  );
}

// ---------- 文本输入 ----------
export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  const pal = usePalette();
  return (
    <View style={{ gap: space[2] }}>
      {label ? (
        <Text style={{ color: pal.text.primary, fontSize: fontSize.sm, fontFamily: fonts.sansSemibold }}>
          {label}
        </Text>
      ) : null}
      {children}
      {hint ? (
        <Text style={{ color: pal.text.muted, fontSize: fontSize.xs, fontFamily: fonts.sans }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType,
  autoCapitalize,
  maxLength,
  editable = true,
  style,
  testID,
}: {
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "characters" | "sentences";
  maxLength?: number;
  editable?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const pal = usePalette();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={pal.text.muted}
      secureTextEntry={secureTextEntry}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      maxLength={maxLength}
      editable={editable}
      style={[
        {
          backgroundColor: pal.surface[3],
          color: pal.text.primary,
          borderColor: pal.border.default,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
          paddingVertical: space[3],
          fontSize: fontSize.base,
          fontFamily: fonts.sans,
          opacity: editable ? 1 : 0.6,
        },
        multiline && { minHeight: 140, textAlignVertical: "top" },
        style,
      ]}
    />
  );
}

// ---------- 分隔线 ----------
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const pal = usePalette();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: pal.border.subtle }, style]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  full: { width: "100%" },
  row: { flexDirection: "row", alignItems: "center" },
  scrollContent: { padding: space[4], paddingBottom: space[16] },
});
