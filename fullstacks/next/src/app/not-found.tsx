import Link from "next/link";

export default function NotFound() {
  return (
    <main className="cy-container">
      <div className="cy-empty" style={{ marginTop: "var(--space-16)" }}>
        <div className="cy-empty__emoji">🛰</div>
        <p>这条路径不在时间轴上。</p>
        <Link
          className="cy-btn cy-btn--ghost cy-btn--sm"
          href="/"
          style={{ marginTop: "var(--space-3)" }}
        >
          回到广场
        </Link>
      </div>
    </main>
  );
}
