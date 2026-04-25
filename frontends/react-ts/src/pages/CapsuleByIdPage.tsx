import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail as CapsuleDetailT } from "@/types";
import { CapsuleDetail } from "@/components/CapsuleDetail";
import { Alert } from "@/components/Alert";

export function CapsuleByIdPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [cap, setCap] = useState<CapsuleDetailT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCapsule = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      if (showLoading) setLoading(true);
      setErr(null);
      try {
        const c = await api.capsuleById(id);
        setCap(c);
        return c;
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "胶囊不存在");
        return null;
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .capsuleById(id)
      .then((c) => {
        if (alive) setCap(c);
      })
      .catch((e) => {
        if (alive) setErr(e instanceof ApiError ? e.message : "胶囊不存在");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <main className="cy-container">
      {loading ? (
        <div className="cy-empty"><p>加载中…</p></div>
      ) : cap ? (
        <CapsuleDetail
          capsule={cap}
          onChange={setCap}
          onExpired={() => loadCapsule({ showLoading: false })}
        />
      ) : (
        <div style={{ maxWidth: 560, margin: "var(--space-12) auto" }}>
          <Alert variant="danger">{err ?? "胶囊不存在"}</Alert>
          <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
            <Link className="cy-btn cy-btn--ghost" to="/">返回广场</Link>
          </div>
        </div>
      )}
    </main>
  );
}
