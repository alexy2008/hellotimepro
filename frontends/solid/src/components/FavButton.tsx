// ============================================================
// 收藏按钮：两套皮肤同一份标记（.fav），卡片与详情页共用。
// - 2.0 起任何胶囊都能收藏（自己的、未公开的都可以）
// - 匿名用户先弹确认框提示登录，确认后带 ?redirect= 去登录
// - 乐观更新：点了立刻变，请求失败再滚回去并提示
// ============================================================

import { For, Show, createEffect, createSignal, on } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { api } from "@/api/client";
import { auth, getSessionVersion } from "@/stores/auth";
import { patchFavorited } from "@/stores/plaza";
import { toast } from "@/stores/feedback";
import { askLogin } from "@/components/LoginPrompt";
import { loginPath } from "@/lib/redirect";
import { fmt, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";

// 同一枚胶囊的请求可以跨换肤完成，由当前会话共享提交锁。
const pending = new Map<string, number>();

interface Props {
  capsule: { id: string; inPlaza: boolean; favoritedByMe: boolean; favoriteCount: number };
  size?: "sm" | "md";
  onChange?: (favorited: boolean, count: number) => void;
}

export function FavButton(props: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [on_, setOn] = createSignal(props.capsule.favoritedByMe);
  const [count, setCount] = createSignal(props.capsule.favoriteCount);
  const [pop, setPop] = createSignal(false);
  const [burst, setBurst] = createSignal(false);
  let el!: HTMLButtonElement;

  // 外部数据变了（列表刷新、另一处收藏）时跟上
  createEffect(
    on(
      () => [props.capsule.id, props.capsule.favoritedByMe, props.capsule.favoriteCount] as const,
      ([, fav, n]) => {
        setOn(fav);
        setCount(n);
      },
      { defer: true },
    ),
  );

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.user) {
      if (await askLogin("favorite")) navigate(loginPath(location.pathname + location.search));
      return;
    }
    const session = getSessionVersion();
    const { id, inPlaza } = props.capsule;
    const onChange = props.onChange;
    if (pending.get(id) === session) return;
    pending.set(id, session);
    const next = !on_();
    const prev = { on: on_(), count: count() };
    const guess = Math.max(0, prev.count + (next ? 1 : -1));
    setOn(next);
    setCount(guess);
    if (next) {
      // 先摘掉 is-pop、强制回流再加回去，心形的弹跳动画才会重播
      setPop(false);
      void el.offsetWidth;
      setPop(true);
      setBurst(true);
      setTimeout(() => setBurst(false), 720);
    }
    try {
      let final = guess;
      if (next) final = (await api.favorite(id)).favoriteCount;
      else await api.unfavorite(id);

      if (session !== getSessionVersion()) return;
      if (!next) toast("已取消收藏");
      setOn(next);
      setCount(final);
      onChange?.(next, final);
      if (inPlaza) patchFavorited(id, next, final);
    } catch {
      if (session !== getSessionVersion()) return;
      setOn(prev.on);
      setCount(prev.count);
      toast("收藏没有成功，请稍后再试", { tone: "error" });
    } finally {
      if (pending.get(id) === session) pending.delete(id);
    }
  }

  const md = () => props.size === "md";
  return (
    <button
      ref={el}
      class={`fav fav--${md() ? "md" : "sm"}`}
      classList={{ "is-on": on_(), "is-pop": pop() }}
      type="button"
      aria-pressed={on_()}
      aria-label={`${on_() ? "取消收藏" : "收藏"}，已有 ${count()} 人收藏`}
      data-testid="fav-button"
      data-count={count()}
      onClick={toggle}
    >
      <span class="fav__ic">
        <Icon name="heart" />
        <Show when={burst() && !reducedMotion()}>
          <span class="burst">
            <For each={Array.from({ length: 7 }, (_, i) => i)}>
              {(i) => <i style={{ "--a": `${Math.round(i * 51.4 - 90)}deg`, "--d": `${15 + (i % 3) * 5}px` }} />}
            </For>
          </span>
        </Show>
      </span>
      <Show when={md()}>
        <span class="fav__t">{on_() ? "已收藏" : "收藏"}</span>
      </Show>
      <span class="fav__n">{fmt.num(count())}</span>
    </button>
  );
}
