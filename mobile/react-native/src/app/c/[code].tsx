// 凭码胶囊详情：移植自 CapsuleByCodePage + CapsuleDetail（匿名可访问）。
// 实时倒计时卡 + 到期自动开启轮询 + 复制码 / 分享 / 收藏。

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail } from "@/types";
import { countdownTo, fmtDateTime } from "@/utils/format";
import { fontSize, radius, space, usePalette } from "@/theme";
import { Alert, Badge, Button, Card, Screen, T } from "@/components/ui";
import { Avatar } from "@/components/media";
import { FavoriteButton } from "@/components/FavoriteButton";

function CountdownCards({ openAt, now }: { openAt: string; now: number }) {
  const pal = usePalette();
  const cd = countdownTo(openAt, now);
  const units: Array<{ v: number; l: string }> = [
    { v: cd.days, l: "天" },
    { v: cd.hours, l: "时" },
    { v: cd.minutes, l: "分" },
    { v: cd.seconds, l: "秒" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: space[2], justifyContent: "center" }}>
      {units.map((u, i) => (
        <View key={i} style={{ alignItems: "center", gap: space[1] }}>
          <View
            style={{
              minWidth: 60,
              paddingVertical: space[3],
              paddingHorizontal: space[2],
              backgroundColor: pal.surface[2],
              borderColor: pal.capsule.sealed.border,
              borderWidth: 1,
              borderRadius: radius.md,
              alignItems: "center",
              shadowColor: pal.capsule.sealed.border,
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <T mono weight="700" size={fontSize["3xl"]} tone="signal">
              {String(u.v).padStart(2, "0")}
            </T>
          </View>
          <T tone="muted" size={fontSize.xs}>
            {u.l}
          </T>
        </View>
      ))}
    </View>
  );
}

export default function CapsuleDetailScreen() {
  const pal = usePalette();
  const router = useRouter();
  const { code = "" } = useLocalSearchParams<{ code: string }>();

  const [cap, setCap] = useState<CapsuleDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [codeCopied, setCodeCopied] = useState(false);

  const loadCapsule = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      if (showLoading) setLoading(true);
      setErr(null);
      try {
        const c = await api.capsuleByCode(String(code).toUpperCase());
        setCap(c);
        return c;
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "胶囊不存在");
        return null;
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [code],
  );

  useEffect(() => {
    void loadCapsule();
  }, [loadCapsule]);

  const opened = cap?.isOpened ?? false;

  // 每秒刷新倒计时（仅未开启）
  useEffect(() => {
    if (!cap || opened) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cap, opened]);

  // 到期后轮询自动开启
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (!cap || opened) return;
    const openAtMs = new Date(cap.openAt).getTime();
    if (Number.isNaN(openAtMs)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (!aliveRef.current) return;
      const refreshed = await loadCapsule({ showLoading: false });
      if (aliveRef.current && !refreshed?.isOpened) {
        timer = setTimeout(poll, 1000);
      }
    }
    timer = setTimeout(poll, Math.max(0, openAtMs - Date.now() + 250));
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cap, opened, loadCapsule]);

  async function copyCode() {
    if (!cap) return;
    await Clipboard.setStringAsync(cap.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function share() {
    if (!cap) return;
    try {
      await Share.share({ message: `HelloTime Pro 时光胶囊「${cap.title}」· 胶囊码 ${cap.code}` });
    } catch {
      /* 用户取消分享 */
    }
  }

  const cd = cap ? countdownTo(cap.openAt, now) : null;

  return (
    <Screen scroll contentStyle={{ gap: space[5] }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={8}>
        <T tone="signal">‹ 返回</T>
      </Pressable>

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: space[16] }}>
          <T tone="muted">加载中…</T>
        </View>
      ) : cap ? (
        <View style={{ gap: space[5] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
            <Badge label={opened ? "已开启" : "未开启"} kind={opened ? "opened" : "sealed"} />
            {cap.inPlaza ? <Badge label="广场公开" kind="plaza" /> : null}
            <T tone="signal" mono size={fontSize.sm}>
              {cap.code}
            </T>
          </View>

          <T display weight="700" size={fontSize["3xl"]}>
            {cap.title}
          </T>

          {opened && cap.content !== null ? (
            <Card style={{ gap: space[3] }}>
              <T tone="muted" size={fontSize.sm}>
                🔓 开启于 {fmtDateTime(cap.openAt)}
              </T>
              <T size={fontSize.base} style={{ lineHeight: fontSize.base * 1.7 }}>
                {cap.content}
              </T>
            </Card>
          ) : (
            <Card style={{ alignItems: "center", gap: space[4], paddingVertical: space[8] }}>
              <T size={40}>🔒</T>
              <T tone="secondary" size={fontSize.sm} center>
                这封信还在上锁，将在以下时刻开启
              </T>
              {cap ? <CountdownCards openAt={cap.openAt} now={now} /> : null}
              <T tone="secondary" size={fontSize.sm} center>
                {cd?.expired ? "正在开启…" : `开启于 ${fmtDateTime(cap.openAt)}`}
              </T>
            </Card>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <T tone="secondary" size={fontSize.sm}>
              来自
            </T>
            <Avatar avatarId={cap.creator.avatarId} size={28} />
            <T weight="600" size={fontSize.sm}>
              {cap.creator.nickname}
            </T>
          </View>

          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
            <Button title={codeCopied ? "✓ 已复制" : "📎 复制码"} variant="ghost" size="sm" onPress={copyCode} />
            <Button title="🔗 分享" variant="ghost" size="sm" onPress={share} />
            <FavoriteButton
              capsule={cap}
              size="md"
              onChange={(fav, count) => setCap({ ...cap, favoritedByMe: fav, favoriteCount: count })}
            />
          </View>

          {!opened ? (
            <Alert variant="info">未开启的胶囊仅显示标题与倒计时，内容将在开启后公开。</Alert>
          ) : cap.inPlaza ? (
            <Alert variant="success">这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。</Alert>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: space[4], paddingVertical: space[12] }}>
          <Alert variant="danger">{err ?? "胶囊不存在"}</Alert>
          <Button title="返回输入码" variant="ghost" onPress={() => router.replace("/open")} />
        </View>
      )}
    </Screen>
  );
}
