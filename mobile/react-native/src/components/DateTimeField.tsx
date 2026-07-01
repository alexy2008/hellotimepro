// 开启时间选择器（移动版）：对标 Web 端 DateTimePicker 的「可键盘输入 + 预设 + 距开启提示」。
// 底部弹层内 5 个步进字段（年/月/日/时/分，可直接输入或 ± 微调）+ 快捷预设。
// 图形日历/表盘在移动端从简，但选任意未来时刻 + 手输 + 预设的功能对齐 Web。

import { useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { pad2 } from "@/utils/format";
import { fonts, fontSize, radius, space, usePalette } from "@/theme";
import { Button, Input, T } from "./ui";

type Preset = "1m" | "1h" | "tomorrow9" | "1y" | "y2030";
type ManualField = "year" | "month" | "day" | "hour" | "minute";

function parseLocal(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date();
  fallback.setSeconds(0, 0);
  return fallback;
}

function toLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDisplay(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDistance(d: Date): string {
  const diffMinutes = Math.ceil((d.getTime() - Date.now()) / 60000);
  if (diffMinutes <= 0) return "已到开启时刻";
  if (diffMinutes < 60) return `距开启 ${diffMinutes} 分钟`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours < 24) return `距开启 ${hours} 小时${minutes ? ` ${minutes} 分钟` : ""}`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days < 365) return `距开启 ${days} 天${restHours ? ` ${restHours} 小时` : ""}`;
  const years = Math.floor(days / 365);
  const restDays = days % 365;
  return `距开启 ${years} 年${restDays ? ` ${restDays} 天` : ""}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function withPreset(spec: Preset): Date {
  const next = new Date();
  next.setSeconds(0, 0);
  switch (spec) {
    case "1m":
      next.setMinutes(next.getMinutes() + 2);
      return next;
    case "1h":
      next.setHours(next.getHours() + 1);
      return next;
    case "tomorrow9":
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next;
    case "1y":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    case "y2030":
      return new Date(2030, 0, 1, 0, 0, 0, 0);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "1m", label: "1分钟后" },
  { key: "1h", label: "1小时后" },
  { key: "tomorrow9", label: "明天9:00" },
  { key: "1y", label: "1年后" },
  { key: "y2030", label: "2030.01.01" },
];

function Stepper({
  label,
  value,
  onChange,
  width = 64,
}: {
  label: string;
  value: number;
  onChange: (delta: number) => void;
  width?: number;
}) {
  const pal = usePalette();
  return (
    <View style={{ alignItems: "center", gap: space[1] }}>
      <T tone="muted" size={fontSize.xs}>
        {label}
      </T>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: pal.surface[3],
          borderColor: pal.border.default,
          borderWidth: 1,
          borderRadius: radius.md,
        }}
      >
        <Pressable onPress={() => onChange(-1)} hitSlop={6} style={{ paddingHorizontal: space[2], paddingVertical: space[2] }}>
          <T tone="signal" size={fontSize.lg}>
            −
          </T>
        </Pressable>
        <View style={{ width, alignItems: "center" }}>
          <T weight="600" mono size={fontSize.lg}>
            {value}
          </T>
        </View>
        <Pressable onPress={() => onChange(1)} hitSlop={6} style={{ paddingHorizontal: space[2], paddingVertical: space[2] }}>
          <T tone="signal" size={fontSize.lg}>
            +
          </T>
        </Pressable>
      </View>
    </View>
  );
}

export function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pal = usePalette();
  const valueDate = useMemo(() => parseLocal(value), [value]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(valueDate);
  const [yearText, setYearText] = useState(String(valueDate.getFullYear()));

  function openSheet() {
    setDraft(valueDate);
    setYearText(String(valueDate.getFullYear()));
    setOpen(true);
  }

  function adjust(field: ManualField, delta: number) {
    const next = new Date(draft);
    if (field === "year") {
      const y = clamp(draft.getFullYear() + delta, 1970, 9999);
      next.setFullYear(y, draft.getMonth(), Math.min(draft.getDate(), daysInMonth(y, draft.getMonth())));
    } else if (field === "month") {
      next.setMonth(draft.getMonth() + delta);
    } else if (field === "day") {
      next.setDate(draft.getDate() + delta);
    } else if (field === "hour") {
      next.setHours(draft.getHours() + delta);
    } else {
      next.setMinutes(draft.getMinutes() + delta);
    }
    setDraft(next);
    setYearText(String(next.getFullYear()));
  }

  function commitYear(text: string) {
    setYearText(text);
    const y = Number(text);
    if (text.length === 4 && Number.isFinite(y)) {
      const next = new Date(draft);
      next.setFullYear(clamp(y, 1970, 9999), draft.getMonth(), Math.min(draft.getDate(), daysInMonth(y, draft.getMonth())));
      setDraft(next);
    }
  }

  function confirm() {
    onChange(toLocalValue(draft));
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={openSheet}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          backgroundColor: pal.surface[3],
          borderColor: pal.border.default,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: space[3],
        }}
      >
        <T size={fontSize.lg}>⏱</T>
        <View style={{ flex: 1 }}>
          <T weight="600">{formatDisplay(valueDate)}</T>
          <T tone="muted" size={fontSize.xs}>
            {formatDistance(valueDate)}
          </T>
        </View>
        <T tone="muted">⌄</T>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: pal.surface.overlay }} onPress={() => setOpen(false)} />
        <View
          style={{
            backgroundColor: pal.surface[1],
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderColor: pal.border.subtle,
            borderWidth: 1,
            padding: space[5],
            gap: space[4],
          }}
        >
          <View>
            <T tone="muted" size={fontSize.xs}>
              选择开启时刻
            </T>
            <T weight="700" display size={fontSize.xl}>
              {formatDistance(draft)}
            </T>
          </View>

          <View style={{ gap: space[2] }}>
            <T tone="muted" size={fontSize.xs}>
              年份（可直接输入）
            </T>
            <Input value={yearText} onChangeText={commitYear} keyboardType="numeric" maxLength={4} style={{ width: 120 }} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[3], justifyContent: "space-between" }}>
            <Stepper label="月" value={draft.getMonth() + 1} onChange={(d) => adjust("month", d)} width={44} />
            <Stepper label="日" value={draft.getDate()} onChange={(d) => adjust("day", d)} width={44} />
            <Stepper label="时" value={draft.getHours()} onChange={(d) => adjust("hour", d)} width={44} />
            <Stepper label="分" value={draft.getMinutes()} onChange={(d) => adjust("minute", d)} width={44} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.key}
                onPress={() => {
                  const d = withPreset(p.key);
                  setDraft(d);
                  setYearText(String(d.getFullYear()));
                }}
                style={{
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: pal.border.default,
                }}
              >
                <T size={fontSize.sm}>{p.label}</T>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: space[3], justifyContent: "flex-end" }}>
            <Button title="取消" variant="ghost" onPress={() => setOpen(false)} />
            <Button title="确认" variant="primary" onPress={confirm} />
          </View>
        </View>
      </Modal>
    </>
  );
}
