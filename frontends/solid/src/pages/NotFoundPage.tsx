import { A } from "@solidjs/router";

export function NotFoundPage() {
  return (
    <main class="cy-container">
      <div class="cy-empty" style={{ "margin-top": "var(--space-16)" }}>
        <div class="cy-empty__emoji">🛰</div>
        <p>这条路径不在时间轴上。</p>
        <A
          class="cy-btn cy-btn--ghost cy-btn--sm"
          href="/"
          style={{ "margin-top": "var(--space-3)" }}
        >
          回到广场
        </A>
      </div>
    </main>
  );
}
