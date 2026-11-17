import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useUi } from "@/stores/ui";
import { PaperRegisterPage } from "@/skins/paper/AccountPages";
import { AmberRegisterPage } from "@/skins/amber/AccountPages";
import { useGuestRedirect } from "./LoginPage";

export function RegisterPage() {
  const skin = useUi((s) => s.skin);
  const to = useGuestRedirect();
  useEffect(() => {
    document.title = "注册 · HelloTime Pro";
  }, []);
  if (to) return <Navigate to={to} replace />;
  return skin === "paper" ? <PaperRegisterPage /> : <AmberRegisterPage />;
}
