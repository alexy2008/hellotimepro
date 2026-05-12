"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { CapsuleListItem } from "@/types";
import { avatarUrl } from "@/lib/avatar";
import { countdownTo, fmtDate, fmtNumber, pad2 } from "@/lib/format";
import { FavoriteButton } from "./favorite-button";

interface Props {
  capsule: CapsuleListItem;
  showCreator?: boolean;
  rightSlot?: ReactNode; // me-created 列表里替换为撤回按钮
  hideFavorite?: boolean;
}

export function CapsuleCard({
  capsule,
  showCreator = true,
  rightSlot,
  hideFavorite = false,
}: Props) {
  const opened = capsule.isOpened;

  // 倒计时（仅未开启卡片需要每秒刷新）
  // setTick 仅用于触发 re-render，不向 DOM 暴露其值。
  const [, setTick] = useState(0);
  useEffect(() => {
    if (opened) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [opened]);

  const cd = countdownTo(capsule.openAt);

  return (
    <article
      className={`cy-capsule ${opened ? "cy-capsule--opened" : "cy-capsule--sealed"}`}
    >
      <div className="cy-capsule__head">
        <span
          className={`cy-badge ${opened ? "cy-badge--opened" : "cy-badge--sealed"}`}
        >
          {opened ? "已开启" : "未开启"}
        </span>
        <Link
          href={`/c/${capsule.code}`}
          className="cy-capsule__code"
          style={{ textDecoration: "none" }}
        >
          {capsule.code}
        </Link>
      </div>

      <Link
        href={`/c/${capsule.code}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <h3 className="cy-capsule__title">{capsule.title}</h3>
      </Link>

      {!opened && (
        <p className="cy-capsule__countdown">
          ⏳ 还剩 {fmtNumber(cd.days)} 天 · {pad2(cd.hours)}:{pad2(cd.minutes)}:
          {pad2(cd.seconds)}
        </p>
      )}
      {opened && capsule.contentPreview && (
        <p className="cy-capsule__preview">{capsule.contentPreview}</p>
      )}

      <div className="cy-capsule__meta">
        {showCreator ? (
          <span className="cy-capsule__creator">
            <img src={avatarUrl(capsule.creator.avatarId)} alt="" />
            {capsule.creator.nickname}
          </span>
        ) : (
          <span style={{ color: "var(--color-text-muted)" }}>
            创建于 {fmtDate(capsule.createdAt)}
          </span>
        )}
        {rightSlot ?? (!hideFavorite && <FavoriteButton capsule={capsule} />)}
      </div>
    </article>
  );
}
