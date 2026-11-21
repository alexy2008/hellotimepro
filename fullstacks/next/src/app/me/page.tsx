// /me → /me/created（服务端重定向）
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/me/created");
}
