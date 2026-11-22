// /register · 注册
import type { Metadata } from "next";
import { RegisterPage } from "@/views/RegisterPage";

export const metadata: Metadata = { title: "注册 · HelloTime Pro" };

export default function Page() {
  return <RegisterPage />;
}
