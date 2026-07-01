// 关于：移植自 frontends/react-ts/src/pages/AboutPage.tsx。
// 产品简介 + 移动端（RN）技术栈 + 后端技术栈（from /health）+ 后端连通点。

import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api/client";
import { API_BASE } from "@/api/config";
import type { HealthData, StackItem } from "@/types";
import { fontSize, radius, space, usePalette } from "@/theme";
import { Alert, Card, Screen, T } from "@/components/ui";
import { RemoteSvg } from "@/components/media";

const MOBILE_STACK: StackItem[] = [
  { role: "framework", name: "React Native", version: "0.85", iconUrl: "/static/icons/react.svg" },
  { role: "toolchain", name: "Expo", version: "56", iconUrl: null },
  { role: "language", name: "TypeScript", version: "6", iconUrl: "/static/icons/typescript.svg" },
];

const MOBILE_SUMMARY =
  "基于 Expo（SDK 56）+ React Native + TypeScript：Expo Router 文件式路由驱动底部 Tab Bar 导航，" +
  "Zustand 做轻量状态管理，业务逻辑（JWT 刷新 / 收藏计数 / 胶囊开启判定）与类型契约直接复用 Web React 前端。" +
  "与之对照，frontends/react-ts 把同一套 store/api/types 渲染成 DOM，而本端渲染成原生组件 —— " +
  "即「Web React vs Native React」：逻辑/令牌共享，视图层分叉。设计令牌经 codegen 从 tokens.json 落地为 RN 的 tokens.ts。";

function resolveIcon(u: string): string {
  return u.startsWith("http") ? u : `${API_BASE}${u}`;
}

function IconRow({ items }: { items: StackItem[] }) {
  const pal = usePalette();
  return (
    <View style={{ flexDirection: "row", gap: space[6], flexWrap: "wrap", marginBottom: space[3] }}>
      {items.map((it) => (
        <View key={it.name} style={{ alignItems: "center", gap: space[1] }}>
          {it.iconUrl ? (
            <RemoteSvg uri={resolveIcon(it.iconUrl)} size={40} />
          ) : (
            <View style={{ width: 40, height: 40, backgroundColor: pal.surface[2], borderRadius: radius.md }} />
          )}
          <T tone="muted" size={fontSize.xs} mono>
            {it.name}
            {it.version ? ` ${it.version}` : ""}
          </T>
        </View>
      ))}
    </View>
  );
}

export default function AboutScreen() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((d) => {
        if (alive) {
          setHealth(d);
          setConnected(true);
        }
      })
      .catch(() => {
        if (alive) setConnected(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const pal = usePalette();
  const backendItems = health
    ? [...health.stack.items].sort((a, b) => {
        const order = ["framework", "language", "database"];
        return order.indexOf(a.role) - order.indexOf(b.role);
      })
    : [];
  const backendFramework = health?.stack.items.find((it) => it.role === "framework")?.name ?? "—";
  const dot = connected === true ? pal.success.solid : connected === false ? pal.danger.solid : pal.text.muted;

  return (
    <Screen scroll contentStyle={{ gap: space[6] }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={8}>
        <T tone="signal">‹ 返回</T>
      </Pressable>

      <T display weight="700" size={fontSize["3xl"]}>
        关于 <T display weight="700" size={fontSize["3xl"]} tone="signal">HelloTime Pro</T>
      </T>

      <T tone="secondary" size={fontSize.base} style={{ lineHeight: fontSize.base * 1.7 }}>
        一款时光胶囊应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。
        同时也是一个多技术栈对比学习项目：同一份产品需求由多套前后端 / 客户端各自实现，
        共享同一份 API 契约、数据库 schema 与设计 token。
      </T>

      <View style={{ gap: space[3] }}>
        <T display weight="600" size={fontSize.xl}>
          移动端技术栈
        </T>
        <Card style={{ gap: space[2] }}>
          <IconRow items={MOBILE_STACK} />
          <T tone="secondary" size={fontSize.sm} style={{ lineHeight: fontSize.sm * 1.7 }}>
            {MOBILE_SUMMARY}
          </T>
        </Card>
      </View>

      {connected === false ? <Alert variant="danger">无法读取后端信息，请确认后端已在 {API_BASE} 运行。</Alert> : null}

      {health ? (
        <View style={{ gap: space[3] }}>
          <T display weight="600" size={fontSize.xl}>
            后端技术栈
          </T>
          <Card style={{ gap: space[2] }}>
            <IconRow items={backendItems} />
            <T tone="secondary" size={fontSize.sm} style={{ lineHeight: fontSize.sm * 1.7 }}>
              {health.stack.summary}
            </T>
          </Card>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <T tone="muted" size={fontSize.sm}>
          后端 {connected === true ? "在线" : connected === false ? "离线" : "连接中…"} · {backendFramework} · License: MIT
        </T>
      </View>
    </Screen>
  );
}
