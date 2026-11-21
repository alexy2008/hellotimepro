"use client";

import { useEffect } from "react";
import { useUi } from "@/stores/ui";
import { PaperNotFoundPage } from "@/skins/paper/AboutPages";
import { AmberNotFoundPage } from "@/skins/amber/AboutPages";

export function NotFoundPage() {
  const skin = useUi((s) => s.skin);
  useEffect(() => {
    document.title = "查无此页 · HelloTime Pro";
  }, []);
  return skin === "paper" ? <PaperNotFoundPage /> : <AmberNotFoundPage />;
}
