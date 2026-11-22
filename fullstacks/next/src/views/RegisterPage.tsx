"use client";

import { Navigate } from "@/lib/router";
import { useUi } from "@/stores/ui";
import { PaperRegisterPage } from "@/skins/paper/AccountPages";
import { AmberRegisterPage } from "@/skins/amber/AccountPages";
import { useGuestRedirect } from "./LoginPage";

export function RegisterPage() {
  const skin = useUi((s) => s.skin);
  const to = useGuestRedirect();
  if (to) return <Navigate to={to} replace />;
  return skin === "paper" ? <PaperRegisterPage /> : <AmberRegisterPage />;
}
