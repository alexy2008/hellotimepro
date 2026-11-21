// ============================================================
// 「琥珀」广场卡片：一枚专属配色的胶囊。
// 状态由「开启时间 vs 此刻」实时算出，倒计时归零的那一秒当场翻面。
// ============================================================

import { Show } from "solid-js";
import { fmt, ms } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import type { CardProps } from "@/skins/paper/Card";
import { Badge, CapsuleArt, cdShort } from "./parts";

const preview = (text: string | null | undefined, n = 80) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "……" : t;
};

export function AmberCard(props: CardProps) {
  const openAt = () => ms(props.c.openAt);
  const createdAt = () => ms(props.c.createdAt);
  const opened = () => props.c.isOpened || openAt() <= props.now;
  const flipping = () => !props.c.isOpened && openAt() <= props.now; // 刚到点，等列表刷新回来之前先翻面
  return (
    <article
      class={`pc ${opened() ? "is-opened" : "is-locked"}${flipping() ? " is-flipping" : ""}`}
      style={{ "--glow": paletteOf(props.c.code).glow, "--i": props.i ?? 0 }}
      data-testid={props.testId ?? "capsule-card"}
      data-code={props.c.code}
      data-state={opened() ? "opened" : "sealed"}
      data-in-plaza={String(props.c.inPlaza)}
    >
      <a
        class="pc__link"
        href={`/capsules/${props.c.code}`}
        aria-label={`${props.c.title}，${opened() ? "已开启" : "封存中"}`}
        data-testid={props.openTestId ?? "card-open"}
      />
      <div class="pc__top">
        <div class="pc__art">
          <CapsuleArt code={props.c.code} state={opened() ? "opened" : "locked"} width={150} />
        </div>
        <div class="pc__badges">
          <Show when={opened()} fallback={<Badge kind="locked" icon="lock">封存中</Badge>}>
            <Badge kind="opened" icon="mail">
              已开启
            </Badge>
          </Show>
          <Show when={props.rank}>
            <Badge kind="hot" icon="fire">
              热度 No.{props.rank}
            </Badge>
          </Show>
          <Show when={!props.c.inPlaza}>
            <Badge kind="private" icon="lock">
              未公开
            </Badge>
          </Show>
        </div>
      </div>
      <h3 class="pc__title" data-testid="card-title">
        {props.c.title}
      </h3>
      <div class="pc__by">
        <Avatar id={props.c.creator.avatarId} />
        <span class="pc__name">{props.c.creator.nickname}</span>
        <Show when={props.mine}>
          <em class="me-tag">我</em>
        </Show>
        <i />
        封存于 {fmt.date(createdAt())}
      </div>
      <div class="pc__body">
        <Show
          when={opened()}
          fallback={
            <>
              <div class="pc__cd">
                <Icon name="hourglass" />
                <span class="pc__time mono">{cdShort(openAt(), props.now)}</span>后开启
              </div>
              <div class="pc__progress" title="从封存到开启，时间已经走过的比例">
                <span style={{ width: `${Math.max(2, fmt.progress(createdAt(), openAt(), props.now))}%` }} />
              </div>
            </>
          }
        >
          <p class="pc__excerpt">{preview(props.c.contentPreview)}</p>
        </Show>
      </div>
      <div class="pc__foot">
        <span class="pc__when">
          <Icon name="calendar" />
          {fmt.dateTime(openAt())} {opened() ? "已开启" : "开启"}
        </span>
        <FavButton capsule={props.c} onChange={props.onFavChange} />
      </div>
    </article>
  );
}

export function AmberCardSkeleton(props: { i: number }) {
  return (
    <div class="pc pc--skel" style={{ "--i": props.i }} aria-hidden="true">
      <i class="sk" style={{ width: "150px", height: "62px", "border-radius": "999px" }} />
      <i class="sk" style={{ width: "70%", height: "22px", "margin-top": "30px" }} />
      <i class="sk" style={{ width: "45%", height: "13px", "margin-top": "12px" }} />
      <i class="sk" style={{ width: "100%", height: "13px", "margin-top": "22px" }} />
      <i class="sk" style={{ width: "82%", height: "13px", "margin-top": "10px" }} />
      <i class="sk" style={{ width: "100%", height: "13px", "margin-top": "30px" }} />
    </div>
  );
}
