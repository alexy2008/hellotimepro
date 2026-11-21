// /create · 写一枚胶囊（需登录）
import { AuthGate } from "@/components/AuthGate";
import { CreatePage } from "@/views/CreatePage";

export default function Page() {
  return (
    <AuthGate>
      <CreatePage />
    </AuthGate>
  );
}
