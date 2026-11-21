import { PaperNotFoundPage } from "@/skins/paper/AboutPages";
import { AmberNotFoundPage } from "@/skins/amber/AboutPages";
import { Skinned } from "./Skinned";

export function NotFoundPage() {
  document.title = "查无此页 · HelloTime Pro";
  return <Skinned paper={<PaperNotFoundPage />} amber={<AmberNotFoundPage />} />;
}
