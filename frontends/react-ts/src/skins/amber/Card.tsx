// ============================================================
// 「琥珀」广场卡片：一枚专属配色的胶囊。
// 状态由「开启时间 vs 此刻」实时算出，倒计时归零的那一秒当场翻面。
// ============================================================

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { CapsuleListItem } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import { Badge, CapsuleArt, cdShort } from "./parts";

const preview = (text: string | null | undefined, n = 80) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "……" : t;
};

export function AmberCard({ c, i = 0, rank = 0, mine = false, now }: {
  c: CapsuleListItem; i?: number; rank?: number; mine?: boolean; now: number;
}) {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  const opened = c.isOpened || openAt <= now;
  const flipping = !c.isOpened && openAt <= now; // 刚到点，等列表刷新回来之前先翻面
  const p = paletteOf(c.code);
  return (
    <article
      className={`pc ${opened ? "is-opened" : "is-locked"}${flipping ? " is-flipping" : ""}`}
      style={{ "--glow": p.glow, "--i": i } as CSSProperties}
      data-testid="capsule-card"
      data-code={c.code}
      data-state={opened ? "opened" : "sealed"}
    >
      <Link className="pc__link" to={`/capsules/${c.code}`} aria-label={`${c.title}，${opened ? "已开启" : "封存中"}`} data-testid="card-open" />
      <div className="pc__top">
        <div className="pc__art">
          <CapsuleArt code={c.code} state={opened ? "opened" : "locked"} width={150} />
        </div>
        <div className="pc__badges">
          {opened ? <Badge kind="opened" icon="mail">已开启</Badge> : <Badge kind="locked" icon="lock">封存中</Badge>}
          {rank ? <Badge kind="hot" icon="fire">热度 No.{rank}</Badge> : null}
          {c.inPlaza ? null : <Badge kind="private" icon="lock">未公开</Badge>}
        </div>
      </div>
      <h3 className="pc__title" data-testid="card-title">
        {c.title}
      </h3>
      <div className="pc__by">
        <Avatar id={c.creator.avatarId} />
        <span className="pc__name">{c.creator.nickname}</span>
        {mine ? <em className="me-tag">我</em> : null}
        <i />
        封存于 {fmt.date(createdAt)}
      </div>
      <div className="pc__body">
        {opened ? (
          <p className="pc__excerpt">{preview(c.contentPreview)}</p>
        ) : (
          <>
            <div className="pc__cd">
              <Icon name="hourglass" />
              <span className="pc__time mono">{cdShort(openAt, now)}</span>后开启
            </div>
            <div className="pc__progress" title="从封存到开启，时间已经走过的比例">
              <span style={{ width: `${Math.max(2, fmt.progress(createdAt, openAt, now))}%` }} />
            </div>
          </>
        )}
      </div>
      <div className="pc__foot">
        <span className="pc__when">
          <Icon name="calendar" />
          {fmt.dateTime(openAt)} {opened ? "已开启" : "开启"}
        </span>
        <FavButton capsule={c} />
      </div>
    </article>
  );
}

export function AmberCardSkeleton({ i }: { i: number }) {
  return (
    <div className="pc pc--skel" style={{ "--i": i } as CSSProperties} aria-hidden="true">
      <i className="sk" style={{ width: 150, height: 62, borderRadius: 999 }} />
      <i className="sk" style={{ width: "70%", height: 22, marginTop: 30 }} />
      <i className="sk" style={{ width: "45%", height: 13, marginTop: 12 }} />
      <i className="sk" style={{ width: "100%", height: 13, marginTop: 22 }} />
      <i className="sk" style={{ width: "82%", height: 13, marginTop: 10 }} />
      <i className="sk" style={{ width: "100%", height: 13, marginTop: 30 }} />
    </div>
  );
}
