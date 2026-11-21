// /me/:tab · 我的（created / favorites / profile，需登录）
import { AuthGate } from "@/components/AuthGate";
import { MePage } from "@/views/MePage";

export default function Page() {
  return (
    <AuthGate>
      <MePage />
    </AuthGate>
  );
}
