// ============================================================
// 收藏按钮：两套皮肤同一份标记（.fav），卡片与详情页共用。
// - 2.0 起任何胶囊都能收藏（自己的、未公开的都可以）
// - 匿名用户先弹确认框提示登录，确认后带 ?redirect= 去登录
// - 乐观更新：点了立刻变，请求失败再滚回去并提示
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/stores/auth";
import { usePlaza } from "@/stores/plaza";
import { toast } from "@/stores/feedback";
import { askLogin } from "@/components/LoginPrompt";
import { loginPath } from "@/lib/redirect";
import { fmt, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";

interface Props {
  capsule: { id: string; favoritedByMe: boolean; favoriteCount: number };
  size?: "sm" | "md";
  onChange?: (favorited: boolean, count: number) => void;
}

export function FavButton({ capsule, size = "sm", onChange }: Props) {
  const user = useAuth((s) => s.user);
  const patchPlaza = usePlaza((s) => s.patchFavorited);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [on, setOn] = useState(capsule.favoritedByMe);
  const [count, setCount] = useState(capsule.favoriteCount);
  const [pop, setPop] = useState(0);
  const [burst, setBurst] = useState(false);
  const busy = useRef(false);

  // 外部数据变了（列表刷新、另一处收藏）时跟上
  useEffect(() => {
    setOn(capsule.favoritedByMe);
    setCount(capsule.favoriteCount);
  }, [capsule.id, capsule.favoritedByMe, capsule.favoriteCount]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      if (await askLogin("favorite")) navigate(loginPath(pathname + search));
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const next = !on;
    const prev = { on, count };
    const guess = Math.max(0, count + (next ? 1 : -1));
    setOn(next);
    setCount(guess);
    if (next) {
      setPop((n) => n + 1);
      setBurst(true);
      setTimeout(() => setBurst(false), 720);
    }
    try {
      let final = guess;
      if (next) final = (await api.favorite(capsule.id)).favoriteCount;
      else {
        await api.unfavorite(capsule.id);
        toast("已取消收藏");
      }
      setCount(final);
      patchPlaza(capsule.id, next, final);
      onChange?.(next, final);
    } catch {
      setOn(prev.on);
      setCount(prev.count);
      toast("收藏没有成功，请稍后再试", { tone: "error" });
    } finally {
      busy.current = false;
    }
  }

  const md = size === "md";
  return (
    <button
      className={`fav fav--${md ? "md" : "sm"}${on ? " is-on" : ""}${pop ? " is-pop" : ""}`}
      key={pop /* 每次收藏重新挂载 is-pop，动画才会重播 */}
      type="button"
      aria-pressed={on}
      aria-label={`${on ? "取消收藏" : "收藏"}，已有 ${count} 人收藏`}
      data-testid="fav-button"
      data-count={count}
      onClick={toggle}
    >
      <span className="fav__ic">
        <Icon name="heart" />
        {burst && !reducedMotion() ? (
          <span className="burst">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} style={{ "--a": `${Math.round(i * 51.4 - 90)}deg`, "--d": `${15 + (i % 3) * 5}px` } as React.CSSProperties} />
            ))}
          </span>
        ) : null}
      </span>
      {md ? <span className="fav__t">{on ? "已收藏" : "收藏"}</span> : null}
      <span className="fav__n">{fmt.num(count)}</span>
    </button>
  );
}
