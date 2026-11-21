// 当前后端的 /health：页脚与关于页共用，整个应用只请求一次（失败了下次再试）
import { api } from "@/api/client";
import type { HealthData } from "@/types";

class Health {
  health = $state.raw<HealthData | null>(null);
  /** null = 连接中 */
  online = $state<boolean | null>(null);
  backend = $derived(this.health?.stack.items ?? []);
  /** 后端的名字：优先取「框架」那一项 */
  backendName = $derived(this.backend.find((i) => i.role === "framework")?.name ?? this.backend[0]?.name);
  #pending: Promise<void> | null = null;

  load() {
    if (this.health || this.#pending) return;
    this.#pending = api
      .health()
      .then((h) => {
        this.health = h;
        this.online = true;
      })
      .catch(() => {
        this.online = false;
      })
      .finally(() => (this.#pending = null));
  }
}

export const health = new Health();
