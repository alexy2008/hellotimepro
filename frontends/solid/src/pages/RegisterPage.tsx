import { Navigate } from "@solidjs/router";
import { createAvatarIds, createRegister } from "@/primitives/account";
import { PaperRegisterPage } from "@/skins/paper/AccountPages";
import { AmberRegisterPage } from "@/skins/amber/AccountPages";
import { guestRedirect } from "./LoginPage";
import { Skinned } from "./Skinned";

export function RegisterPage() {
  const to = guestRedirect();
  if (to) return <Navigate href={to} />;
  document.title = "注册 · HelloTime Pro";
  return <RegisterForm />;
}

function RegisterForm() {
  const f = createRegister();
  const ids = createAvatarIds();
  return <Skinned paper={<PaperRegisterPage f={f} ids={ids} />} amber={<AmberRegisterPage f={f} ids={ids} />} />;
}
