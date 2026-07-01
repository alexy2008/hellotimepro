// 账号设置（门禁）：移植自 frontends/react-ts/src/pages/MeProfilePage.tsx。
// 基本信息（昵称/头像）+ 修改密码（改后自动登出）。

import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import { fontSize, space } from "@/theme";
import { Alert, Button, Card, Field, Input, Screen, T } from "@/components/ui";
import { AuthGate } from "@/components/AuthGate";
import { AvatarPicker } from "@/components/AvatarPicker";

type Msg = { type: "info" | "success" | "danger"; text: string } | null;

function SettingsForm() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const refreshMe = useAuth((s) => s.refreshMe);
  const logout = useAuth((s) => s.logout);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatarId, setAvatarId] = useState<string | null>(user?.avatarId ?? null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<Msg>(null);

  useEffect(() => {
    api.avatars().then(setAvatars).catch(() => {});
  }, []);
  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setAvatarId(user.avatarId);
    }
  }, [user]);

  async function saveProfile() {
    setProfileMsg(null);
    setProfileBusy(true);
    try {
      const patch: { nickname?: string; avatarId?: string } = {};
      if (user && nickname !== user.nickname) patch.nickname = nickname.trim();
      if (user && avatarId && avatarId !== user.avatarId) patch.avatarId = avatarId;
      if (Object.keys(patch).length === 0) {
        setProfileMsg({ type: "info", text: "没有改动" });
        return;
      }
      await api.updateProfile(patch);
      await refreshMe();
      setProfileMsg({ type: "success", text: "已保存" });
    } catch (e) {
      setProfileMsg({ type: "danger", text: e instanceof ApiError ? e.message : "保存失败" });
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword() {
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "danger", text: "两次输入的新密码不一致" });
      return;
    }
    setPwdBusy(true);
    try {
      await api.changePassword({ currentPassword: oldPwd, newPassword: newPwd });
      setPwdMsg({ type: "success", text: "密码已更新，3 秒后将自动登出。" });
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => {
        void logout(false).then(() => router.replace("/login"));
      }, 3000);
    } catch (e) {
      setPwdMsg({ type: "danger", text: e instanceof ApiError ? e.message : "修改失败" });
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <Screen scroll contentStyle={{ gap: space[5] }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/me"))} hitSlop={8}>
        <T tone="signal">‹ 返回</T>
      </Pressable>
      <T display weight="700" size={fontSize["2xl"]}>
        账号设置
      </T>

      <Card style={{ gap: space[4] }}>
        <T display weight="600" size={fontSize.lg}>
          基本信息
        </T>
        <Field label="邮箱" hint="邮箱作为登录账号不可修改。">
          <Input value={user?.email ?? ""} editable={false} />
        </Field>
        <Field label="昵称">
          <Input value={nickname} onChangeText={setNickname} maxLength={20} />
        </Field>
        <Field label="头像">
          <AvatarPicker avatars={avatars} value={avatarId} onChange={setAvatarId} />
        </Field>
        {profileMsg ? <Alert variant={profileMsg.type}>{profileMsg.text}</Alert> : null}
        <View style={{ flexDirection: "row", gap: space[3], justifyContent: "flex-end" }}>
          <Button
            title="重置"
            variant="ghost"
            onPress={() => {
              if (user) {
                setNickname(user.nickname);
                setAvatarId(user.avatarId);
              }
            }}
          />
          <Button title={profileBusy ? "保存中…" : "保存更改"} onPress={saveProfile} disabled={profileBusy} />
        </View>
      </Card>

      <Card style={{ gap: space[4] }}>
        <T display weight="600" size={fontSize.lg}>
          修改密码
        </T>
        <Field label="当前密码">
          <Input value={oldPwd} onChangeText={setOldPwd} secureTextEntry />
        </Field>
        <Field label="新密码" hint="至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。">
          <Input value={newPwd} onChangeText={setNewPwd} secureTextEntry />
        </Field>
        <Field label="确认新密码">
          <Input value={confirmPwd} onChangeText={setConfirmPwd} secureTextEntry />
        </Field>
        {pwdMsg ? <Alert variant={pwdMsg.type}>{pwdMsg.text}</Alert> : null}
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Button title={pwdBusy ? "更新中…" : "更新密码"} onPress={changePassword} disabled={pwdBusy} />
        </View>
      </Card>
    </Screen>
  );
}

export default function SettingsScreen() {
  return (
    <AuthGate>
      <SettingsForm />
    </AuthGate>
  );
}
