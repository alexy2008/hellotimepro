import { createEffect, createSignal, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail as CapsuleDetailT } from "@/types";
import { CapsuleDetail } from "@/components/CapsuleDetail";
import { Alert } from "@/components/Alert";

export function CapsuleByCodePage() {
  const params = useParams<{ code: string }>();
  const [cap, setCap] = createSignal<CapsuleDetailT | null>(null);
  const [err, setErr] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);

  async function loadCapsule(showLoading = true): Promise<CapsuleDetailT | null> {
    if (showLoading) setLoading(true);
    setErr(null);
    try {
      const c = await api.capsuleByCode((params.code ?? "").toUpperCase());
      setCap(c);
      return c;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "胶囊不存在");
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  // code 变化时重新加载
  createEffect(() => {
    params.code;
    void loadCapsule();
  });

  return (
    <main class="cy-container">
      <Show
        when={!loading()}
        fallback={
          <div class="cy-empty">
            <p>加载中…</p>
          </div>
        }
      >
        <Show
          when={cap()}
          fallback={
            <div style={{ "max-width": "560px", margin: "var(--space-12) auto" }}>
              <Alert variant="danger">{err() ?? "胶囊不存在"}</Alert>
              <div style={{ "margin-top": "var(--space-4)", "text-align": "center" }}>
                <A class="cy-btn cy-btn--ghost" href="/open">
                  返回输入码
                </A>
              </div>
            </div>
          }
        >
          {(c) => (
            <CapsuleDetail
              capsule={c()}
              onChange={setCap}
              onExpired={() => loadCapsule(false)}
            />
          )}
        </Show>
      </Show>
    </main>
  );
}
