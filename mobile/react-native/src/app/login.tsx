// 登录（模态）：移植自 frontends/react-ts/src/pages/LoginPage.tsx。

import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { ApiError } from "@/types";
import { fontSize, space } from "@/theme";
import { Alert, Button, Card, Field, Input, Screen, T } from "@/components/ui";

export default function LoginScreen() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const tokens = await api.login({ email: email.trim(), password });
      setTokens(tokens);
      if (router.canGoBack()) router.back();
      else router.replace("/me");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll edges={["top", "left", "right", "bottom"]} contentStyle={{ gap: space[5] }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10}>
          <T tone="muted" size={22}>
            ✕
          </T>
        </Pressable>
      </View>

      <Card style={{ gap: space[4] }}>
        <View style={{ gap: space[1] }}>
          <T display weight="700" size={fontSize["2xl"]}>
            欢迎回来
          </T>
          <T tone="secondary" size={fontSize.sm}>
            你留给未来的信，还在等你开启。
          </T>
        </View>

        <Field label="邮箱">
          <Input testID="login-email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
        </Field>
        <Field label="密码" hint="忘记密码？暂不支持找回，请联系管理员重置。">
          <Input testID="login-password" value={password} onChangeText={setPassword} secureTextEntry />
        </Field>

        <Button testID="login-submit" title={busy ? "登录中…" : "登录"} onPress={submit} disabled={busy} size="lg" full />

        <Pressable onPress={() => router.replace("/register")} style={{ alignItems: "center" }}>
          <T tone="muted" size={fontSize.sm}>
            还没有账号？<T tone="brand" size={fontSize.sm}>立即注册</T>
          </T>
        </Pressable>
      </Card>

      {err ? <Alert variant="danger">{err}</Alert> : null}
    </Screen>
  );
}
