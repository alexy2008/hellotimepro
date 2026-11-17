// ============================================================
// 「时笺」胶囊卡片：同一只信封的两种状态
// 未开启 —— 合着、舌尖钤朱印，正文被模糊遮住，下面是等待进度的刻度尺
// 已开启 —— 封舌掀起、信纸露出半截，两行正文预览
// ============================================================

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { CapsuleListItem } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import { CdShort, Scale, Seal } from "./parts";

const ENV_SEALED = (
  <svg className="cap__art" viewBox="0 0 120 84" aria-hidden="true">
    <rect className="ea__body" x="2" y="6" width="116" height="76" rx="3" />
    <path className="ea__line" d="M2.5 80.5 47 46M117.5 80.5 73 46" />
    <path className="ea__flap" d="M3 7.5 60 48 117 7.5" />
    <g className="ea__seal">
      <circle cx="60" cy="48" r="11" />
      <circle className="ea__seal-ring" cx="60" cy="48" r="7" />
    </g>
  </svg>
);
const ENV_OPENED = (
  <svg className="cap__art" viewBox="0 0 120 100" aria-hidden="true">
    <path className="ea__body" d="M2 42 60 4 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
    <rect className="ea__paper" x="16" y="14" width="88" height="62" rx="1.5" />
    <path className="ea__rule" d="M26 30h68M26 40h68M26 50h68M26 60h44" />
    <path className="ea__pocket" d="M2 42 60 78 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
    <path className="ea__line" d="M2.5 97.5 49 70M117.5 97.5 71 70" />
  </svg>
);

export const preview = (text: string | null | undefined, n = 78) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "……" : t;
};

export function PaperCard({ c, i = 0, rank = 0, mine = false, now }: {
  c: CapsuleListItem; i?: number; rank?: number; mine?: boolean; now: number;
}) {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  const opened = c.isOpened || openAt <= now;
  return (
    <article
      className={`cap cap--${opened ? "opened" : "sealed"}`}
      style={{ "--i": i } as CSSProperties}
      data-testid="capsule-card"
      data-code={c.code}
      data-state={opened ? "opened" : "sealed"}
    >
      <div className="cap__bg" aria-hidden="true">
        {opened ? ENV_OPENED : ENV_SEALED}
      </div>
      <Link
        className="cap__link"
        to={`/capsules/${c.code}`}
        aria-label={`${c.title}，${opened ? "已开启" : "未开启"}`}
        data-testid="card-open"
      />
      <header className="cap__top">
        <Seal ch={opened ? "启" : "封"} variant={opened ? "line" : "solid"} />
        <span className="cap__status">{opened ? "已开启" : "未开启"}</span>
        {c.inPlaza ? null : (
          <span className="cap__private" title="没有发布到广场，凭胶囊码可见">
            <Icon name="lock" />
            未公开
          </span>
        )}
        {rank ? (
          <span className="cap__rank latin" title={`热度第 ${rank}`}>
            No.{rank}
          </span>
        ) : null}
        <span className="cap__code mono">{c.code}</span>
      </header>
      <h3 className="cap__title" data-testid="card-title">
        {c.title}
      </h3>
      {opened ? (
        <>
          <p className="cap__preview">{preview(c.contentPreview)}</p>
          <div className="cap__when">
            <span>启于 {fmt.date(openAt)}</span>
            <i />
            <span>在途 {fmt.span(openAt - createdAt)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="cap__veil" aria-hidden="true">
            <i />
            <i />
          </div>
          <div className="cap__cd">
            <span className="cap__cd-label">距启封</span>
            <span className="cap__cd-val">
              <CdShort openAt={openAt} now={now} />
            </span>
          </div>
          <Scale p={fmt.progress(createdAt, openAt, now)} />
          <div className="cap__ends mono">
            <span>{fmt.date(createdAt)}</span>
            <span>{fmt.date(openAt)}</span>
          </div>
        </>
      )}
      <footer className="cap__foot">
        <span className="who">
          <Avatar id={c.creator.avatarId} />
          <span className="who__n">{c.creator.nickname}</span>
          {mine ? <em className="who__me">我</em> : null}
        </span>
        <FavButton capsule={c} />
      </footer>
    </article>
  );
}

export function PaperCardSkeleton({ i }: { i: number }) {
  return (
    <div className="cap cap--skel" style={{ "--i": i } as CSSProperties} aria-hidden="true">
      <i className="sk sk--a" />
      <i className="sk sk--b" />
      <i className="sk sk--c" />
      <i className="sk sk--c2" />
      <i className="sk sk--d" />
    </div>
  );
}
