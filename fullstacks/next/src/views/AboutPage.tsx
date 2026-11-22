"use client";

import { useUi } from "@/stores/ui";
import { HealthContext } from "@/components/shared";
import { PaperAboutPage } from "@/skins/paper/AboutPages";
import { AmberAboutPage } from "@/skins/amber/AboutPages";
import type { HealthData } from "@/types";

/** 关于：文字两套皮肤共用（lib/about.ts），排版各一份；技术栈来自服务端（app/about/page.tsx） */
export function AboutPage({ health }: { health: HealthData }) {
  const skin = useUi((s) => s.skin);
  return <HealthContext.Provider value={health}>{skin === "paper" ? <PaperAboutPage /> : <AmberAboutPage />}</HealthContext.Provider>;
}
