// 创建：移植自 frontends/react-ts/src/pages/CreatePage.tsx（门禁）。
// AI 推荐/生成 + 标题/正文 + 开启时间选择器 + 快捷预设 + 广场公开开关 + 上锁封存。

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api/client";
import { ApiError, type CapsuleRecommendation } from "@/types";
import { isoToLocalInput, localInputToIso } from "@/utils/format";
import { fontSize, space, usePalette } from "@/theme";
import { Alert, Button, Field, Input, Screen, T } from "@/components/ui";
import { ScreenHeader, ThemeToggle } from "@/components/chrome";
import { AuthGate } from "@/components/AuthGate";
import { DateTimeField } from "@/components/DateTimeField";
import { RecommendationStrip } from "@/components/RecommendationStrip";

type Preset = "1m" | "1h" | "tomorrow9" | "1y" | "y2030";

function presetTime(spec: Preset): string {
  const now = new Date();
  switch (spec) {
    case "1m":
      now.setSeconds(now.getSeconds() + 130);
      break;
    case "1h":
      now.setHours(now.getHours() + 1);
      break;
    case "tomorrow9":
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      break;
    case "1y":
      now.setFullYear(now.getFullYear() + 1);
      break;
    case "y2030":
      return "2030-01-01T00:00";
  }
  return isoToLocalInput(now.toISOString());
}

const QUICK: Array<{ key: Preset; label: string }> = [
  { key: "1m", label: "1 分钟后（测试）" },
  { key: "1h", label: "1 小时后" },
  { key: "tomorrow9", label: "明天 9:00" },
  { key: "1y", label: "1 年后" },
  { key: "y2030", label: "2030.01.01" },
];

function CreateForm() {
  const pal = usePalette();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [openLocal, setOpenLocal] = useState(presetTime("1h"));
  const [inPlaza, setInPlaza] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);

  const [recos, setRecos] = useState<CapsuleRecommendation[]>([]);
  const [recoBusy, setRecoBusy] = useState(false);
  const recoSeq = useRef(0);
  const recoInited = useRef(false);

  async function runAiGenerate(rawTitle: string) {
    const t = rawTitle.trim();
    const autoTitle = !t;
    setErr(null);
    setAiInfo(null);
    setAiBusy(true);
    try {
      const s = await api.suggestCapsule({ title: t || undefined });
      setContent(s.content);
      setOpenLocal(isoToLocalInput(s.openAt));
      setAiGenerated(true);
      if (s.title && autoTitle) setTitle((cur) => (cur.trim() ? cur : s.title!));
      const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
      const titleNote = s.title && autoTitle ? "标题与正文均由 AI 生成" : "已为你生成正文";
      setAiInfo(`${titleNote}，建议 ${s.openInDays} 天后开启 · 来源：${source}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "AI 生成失败，请稍后重试");
    } finally {
      setAiBusy(false);
    }
  }

  const loadRecos = useCallback(async () => {
    const seq = ++recoSeq.current;
    setRecoBusy(true);
    try {
      const list = await api.capsuleRecommendations({ count: 4 });
      if (seq !== recoSeq.current) return;
      if (list.items.length > 0) setRecos(list.items);
    } catch {
      /* 推荐失败静默 */
    } finally {
      if (seq === recoSeq.current) setRecoBusy(false);
    }
  }, []);

  useEffect(() => {
    if (recoInited.current) return;
    recoInited.current = true;
    void loadRecos();
  }, [loadRecos]);

  function pickReco(reco: CapsuleRecommendation) {
    setTitle(reco.title);
    setContent("");
    setAiGenerated(false);
    void runAiGenerate(reco.title);
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const created = await api.createCapsule({
        title: title.trim(),
        content,
        openAt: localInputToIso(openLocal),
        inPlaza,
      });
      router.replace(`/c/${created.code}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="写给未来的信" right={<ThemeToggle />} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[5], paddingBottom: space[20] }}>
        <T tone="secondary" size={fontSize.sm}>
          这段文字会被上锁，直到你设定的时刻才能由任何人 —— 包括你自己 —— 开启。
        </T>

        <Field label="标题 · 最多 60 字">
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <Input testID="create-title" value={title} onChangeText={setTitle} maxLength={60} style={{ flex: 1 }} />
            <Button
              title={aiBusy ? "生成中…" : aiGenerated ? "✨ 重生成" : "✨ AI"}
              variant="ghost"
              onPress={() => void runAiGenerate(title)}
              disabled={aiBusy}
            />
          </View>
          {aiInfo ? (
            <T tone="secondary" size={fontSize.xs}>
              {aiInfo}
            </T>
          ) : null}
        </Field>

        {!title.trim() && recos.length > 0 ? (
          <RecommendationStrip
            recos={recos}
            busy={recoBusy}
            disabled={aiBusy}
            onPick={pickReco}
            onRefresh={() => void loadRecos()}
          />
        ) : null}

        <Field label="内容 · 最多 5000 字" hint={`${content.length} / 5000`}>
          <Input
            testID="create-content"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={5000}
            placeholder={"在这里写下你想传递到未来的话。"}
          />
        </Field>

        <Field label="开启时间 · 最早 60 秒后" hint="时区以你当前所在时区为准，提交时会转换为 UTC。">
          <DateTimeField value={openLocal} onChange={setOpenLocal} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[1] }}>
            {QUICK.map((p) => (
              <Button key={p.key} title={p.label} variant="ghost" size="sm" onPress={() => setOpenLocal(presetTime(p.key))} />
            ))}
          </View>
        </Field>

        <Alert variant="info">上锁后不可编辑、不可提前开启；可以在「我的」里随时撤回（删除）。</Alert>
        {err ? <Alert variant="danger">{err}</Alert> : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Switch
            value={inPlaza}
            onValueChange={setInPlaza}
            trackColor={{ true: pal.brand.primary, false: pal.surface[3] }}
            thumbColor={pal.text.primary}
          />
          <T size={fontSize.sm}>发布到胶囊广场</T>
        </View>

        <Button testID="create-submit" title={busy ? "封存中…" : "🔒 上锁封存"} onPress={submit} disabled={busy} size="lg" full />
      </ScrollView>
    </Screen>
  );
}

export default function CreateScreen() {
  return (
    <AuthGate>
      <CreateForm />
    </AuthGate>
  );
}
