// 开启：移植自 frontends/react-ts/src/pages/OpenPage.tsx。
// 8 位分体码输入 → 校验后跳详情；粘贴用 expo-clipboard。

import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api } from "@/api/client";
import { ApiError } from "@/types";
import { fontSize, space } from "@/theme";
import { Alert, Button, Screen, T } from "@/components/ui";
import { ScreenHeader, ThemeToggle } from "@/components/chrome";
import { CapsuleCodeInput } from "@/components/CapsuleCodeInput";

export default function OpenScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(c: string) {
    if (c.length !== 8) return;
    setErr(null);
    setBusy(true);
    try {
      const cap = await api.capsuleByCode(c);
      router.push(`/c/${cap.code}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "找不到这条胶囊");
    } finally {
      setBusy(false);
    }
  }

  async function paste() {
    try {
      const text = await Clipboard.getStringAsync();
      const filtered = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      setCode(filtered);
      if (filtered.length === 8) void open(filtered);
    } catch {
      setErr("粘贴失败");
    }
  }

  return (
    <Screen>
      <ScreenHeader title="开启胶囊" right={<ThemeToggle />} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[6] }}>
        <View style={{ gap: space[2] }}>
          <T display weight="700" size={fontSize.xl}>
            用 8 位密钥开启胶囊
          </T>
          <T tone="secondary" size={fontSize.sm}>
            输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。
          </T>
        </View>

        <CapsuleCodeInput value={code} onChange={setCode} onComplete={open} />

        <View style={{ flexDirection: "row", gap: space[3], justifyContent: "center" }}>
          <Button
            testID="open-submit"
            title={busy ? "查询中…" : "开启 →"}
            onPress={() => open(code)}
            disabled={busy || code.length !== 8}
            size="lg"
          />
          <Button title="粘贴识别" variant="ghost" onPress={paste} size="lg" />
        </View>

        <View style={{ gap: space[2], alignItems: "center" }}>
          <T tone="muted" size={fontSize.sm} center>
            🔒 未到开启时间的胶囊也会显示倒计时
          </T>
        </View>

        {err ? <Alert variant="danger">{err}</Alert> : null}
      </ScrollView>
    </Screen>
  );
}
