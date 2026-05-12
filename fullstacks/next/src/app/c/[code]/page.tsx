"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import { api } from "@/lib/api-client";
import { ApiError, type CapsuleDetail as CapsuleDetailT } from "@/types";
import { Alert } from "@/components/alert";
import { CapsuleDetail } from "@/components/capsule-detail";

export default function CapsuleByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [cap, setCap] = useState<CapsuleDetailT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCapsule = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}): Promise<CapsuleDetailT | null> => {
      if (showLoading) setLoading(true);
      setErr(null);
      try {
        const c = await api.capsuleByCode(code.toUpperCase());
        setCap(c);
        return c;
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "胶囊不存在");
        return null;
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [code],
  );

  useEffect(() => {
    void loadCapsule();
  }, [loadCapsule]);

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
            <Link className="cy-btn cy-btn--ghost" href="/open">
              返回输入码
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
