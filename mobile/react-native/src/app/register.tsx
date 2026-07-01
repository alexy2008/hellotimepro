// 注册（模态）：移植自 frontends/react-ts/src/pages/RegisterPage.tsx。
// 邮箱/昵称/密码 + 头像选择（必选）→ 注册成功进入创建。

import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import { fontSize, space } from "@/theme";
import { Alert, Button, Card, Field, Input, Screen, T } from "@/components/ui";
import { AvatarPicker } from "@/components/AvatarPicker";

export default function RegisterScreen() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .avatars()
      .then((list) => {
        setAvatars(list);
        if (list.length > 0) setAvatarId(list[0].id);
      })
      .catch(() => setErr("拉取头像列表失败，请检查后端是否已启动"));
  }, []);

  async function submit() {
    setErr(null);
    if (!avatarId) {
      setErr("请选择一个头像");
      return;
    }
    setBusy(true);
    try {
      const tokens = await api.register({
        email: email.trim(),
        password,
        nickname: nickname.trim(),
        avatarId,
      });
      setTokens(tokens);
      router.replace("/create");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "注册失败");
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
            注册新身份
          </T>
          <T tone="secondary" size={fontSize.sm}>
            选一个赛博头像、写一封最早 60 秒后才能打开的信。
          </T>
        </View>

        <Field label="邮箱">
          <Input testID="reg-email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Field label="昵称" hint="2–20 字符，注册后可修改。">
          <Input testID="reg-nickname" value={nickname} onChangeText={setNickname} maxLength={20} />
        </Field>
        <Field label="密码" hint="至少 8 位，需包含字母和数字。">
          <Input testID="reg-password" value={password} onChangeText={setPassword} secureTextEntry />
        </Field>
        <Field label="选择头像（必选）">
          <AvatarPicker avatars={avatars} value={avatarId} onChange={setAvatarId} />
        </Field>

        <Button testID="reg-submit" title={busy ? "提交中…" : "创建账号并进入创建胶囊"} onPress={submit} disabled={busy} size="lg" full />

        <Pressable onPress={() => router.replace("/login")} style={{ alignItems: "center" }}>
          <T tone="muted" size={fontSize.sm}>
            已有账号？<T tone="brand" size={fontSize.sm}>去登录</T>
          </T>
        </Pressable>
      </Card>

      {err ? <Alert variant="danger">{err}</Alert> : null}
    </Screen>
  );
}
