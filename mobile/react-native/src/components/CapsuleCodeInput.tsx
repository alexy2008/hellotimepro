// 8 位分体码输入：移植自 frontends/react-ts/src/components/CapsuleCodeInput.tsx。
// RN 版：8 个 TextInput，自动前进/退格回跳；onKeyPress 处理 Backspace。

import { useEffect, useRef } from "react";
import { TextInput, View } from "react-native";
import { fonts, fontSize, radius, space, usePalette } from "@/theme";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
}

const LEN = 8;

export function CapsuleCodeInput({ value, onChange, onComplete }: Props) {
  const pal = usePalette();
  const refs = useRef<Array<TextInput | null>>([]);
  const chars = Array.from({ length: LEN }, (_, i) => (value[i] ?? "").toUpperCase());

  useEffect(() => {
    if (value.length === LEN) onComplete?.(value);
  }, [value, onComplete]);

  function setAt(i: number, ch: string) {
    const sanitized = ch.toUpperCase().replace(/[^A-Z0-9]/g, "");
    // 支持一次性粘贴多字符
    if (sanitized.length > 1) {
      const next = (chars.slice(0, i).join("") + sanitized).slice(0, LEN);
      onChange(next);
      refs.current[Math.min(next.length, LEN - 1)]?.focus();
      return;
    }
    const next = (chars.slice(0, i).join("") + sanitized + chars.slice(i + 1).join("")).slice(0, LEN);
    onChange(next);
    if (sanitized && i < LEN - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyPress(i: number, key: string) {
    if (key === "Backspace" && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  return (
    <View style={{ flexDirection: "row", gap: space[2], justifyContent: "center" }}>
      {chars.map((ch, i) => (
        <TextInput
          key={i}
          testID={`code-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={ch}
          onChangeText={(t) => setAt(i, t.slice(-1) === "" ? t : t.slice(-1))}
          onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={1}
          selectTextOnFocus
          style={{
            width: 38,
            height: 50,
            textAlign: "center",
            color: pal.text.primary,
            fontFamily: fonts.mono,
            fontSize: fontSize.xl,
            backgroundColor: pal.surface[3],
            borderColor: ch ? pal.signal.primary : pal.border.default,
            borderWidth: 1,
            borderRadius: radius.md,
          }}
        />
      ))}
    </View>
  );
}
