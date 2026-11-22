// /open · 用胶囊码开启
import type { Metadata } from "next";
import { OpenPage } from "@/views/OpenPage";

export const metadata: Metadata = { title: "开启胶囊 · HelloTime Pro" };

export default function Page() {
  return <OpenPage />;
}
