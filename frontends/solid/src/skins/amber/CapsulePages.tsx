// ============================================================
// 「琥珀」胶囊详情（/capsules/:code）与开启页（/open）
// 详情是一台小状态机：封存中（进度环 + 翻牌倒计时）→ 开启中（抖动 · 迸光）→ 信笺
// 结构与类名照 2.0 原型 amber/view-capsule.js
// ============================================================

import { For, Index, Match, Show, Switch, batch, createEffect, createSignal, onCleanup } from "solid-js";
import { fmt, ms, reducedMotion, sleep } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { toast } from "@/stores/feedback";
import { auth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import { CreateLink } from "@/components/LoginPrompt";
import { paragraphs, shareOf, type CapsuleByCode } from "@/primitives/capsule";
import { useCodeOpen } from "@/primitives/codeOpen";
import type { CapsuleDetail, CapsuleListItem } from "@/types";
import { Badge, CapsuleArt, Countdown, Stamp, VisBadge, cdShort } from "./parts";
import { AmberCodeInput } from "./CodeInput";

const RING_C = 2 * Math.PI * 150;
const dash = (t: number) => fmt.dateTime(t).replace(/\./g, "-");

const Back = () => (
  <a class="back" href="/">
    <Icon name="arrow-left" />
    返回广场
  </a>
);

function Actions(props: { c: CapsuleDetail; letter?: boolean }) {
  const share = () => shareOf(props.c.code);
  return (
    <div class="detail__actions">
      <FavButton capsule={props.c} size="md" />
      <button class="btn btn--ghost" type="button" data-testid="copy-code" onClick={() => share().copyCode()}>
        <Icon name="copy" />
        复制胶囊码
      </button>
      <button class="btn btn--ghost" type="button" data-testid="copy-link" onClick={() => share().copyLink()}>
        <Icon name="link" />
        分享链接
      </button>
      <Show when={props.letter}>
        <CreateLink class="btn btn--primary">
          <Icon name="pen" />
          我也写一枚
        </CreateLink>
      </Show>
    </div>
  );
}

function Locked(props: { c: CapsuleDetail; now: number }) {
  const openAt = () => ms(props.c.openAt);
  const createdAt = () => ms(props.c.createdAt);
  const pct = () => Math.min(100, Math.max(0, ((props.now - createdAt()) / (openAt() - createdAt())) * 100));
  return (
    <>
      <Back />
      <section class="vault card" style={{ "--glow": paletteOf(props.c.code).glow }}>
        <div class="vault__dial">
          <svg class="vault__ring" viewBox="0 0 340 340" aria-hidden="true">
            <circle class="vault__track" cx="170" cy="170" r="150" />
            <circle
              class="vault__arc"
              cx="170"
              cy="170"
              r="150"
              style={{ "stroke-dasharray": `${((RING_C * pct()) / 100).toFixed(1)} ${RING_C.toFixed(1)}` }}
            />
          </svg>
          <div class="vault__art">
            <CapsuleArt code={props.c.code} state="locked" width={220} />
          </div>
          <div class="vault__pct">
            <b class="mono">{pct().toFixed(2)}%</b>
            <span>时间已经走过</span>
          </div>
        </div>
        <div class="vault__info">
          <div class="badges">
            <Badge kind="locked" icon="lock">
              封存中
            </Badge>
            <VisBadge inPlaza={props.c.inPlaza} />
          </div>
          <h1 class="vault__title" data-testid="detail-title">
            {props.c.title}
          </h1>
          <div class="vault__by">
            <Avatar id={props.c.creator.avatarId} />
            来自 <b>{props.c.creator.nickname}</b> · 封存于 {fmt.cn(createdAt())}
          </div>
          <div class="vault__k">距离开启还有</div>
          <div data-testid="countdown" data-open-at={props.c.openAt}>
            <Countdown openAt={openAt()} now={props.now} />
          </div>
          <dl class="vault__meta">
            <div>
              <dt>
                <Icon name="calendar" />
                开启时间
              </dt>
              <dd class="mono">{dash(openAt())}</dd>
            </div>
            <div>
              <dt>
                <Icon name="key" />
                胶囊码
              </dt>
              <dd class="mono">{props.c.code}</dd>
            </div>
            <div>
              <dt>
                <Icon name="heart" />
                在等它的人
              </dt>
              <dd class="mono">{fmt.num(props.c.favoriteCount)}</dd>
            </div>
          </dl>
          <p class="tip">
            <Icon name="sparkle" />
            <span>不用刷新页面——倒计时归零的那一刻，它会自己打开。</span>
          </p>
          <Actions c={props.c} />
        </div>
      </section>
    </>
  );
}

function Letter(props: { c: CapsuleDetail; reveal: boolean }) {
  const openAt = () => ms(props.c.openAt);
  const createdAt = () => ms(props.c.createdAt);
  return (
    <>
      <Back />
      <div class={`letter-page${props.reveal ? " is-reveal" : ""}`}>
        <article class="letter">
          <div class="letter__meta">
            <span class="mono">{props.c.code}</span>
            <i />
            <VisBadge inPlaza={props.c.inPlaza} />
          </div>
          <h1 class="letter__title" data-testid="detail-title">
            {props.c.title}
          </h1>
          <div class="letter__from">
            <Avatar id={props.c.creator.avatarId} />
            {props.c.creator.nickname} 写于 {fmt.cn(createdAt())}
          </div>
          <div class="letter__body" data-testid="detail-content">
            <Index each={paragraphs(props.c.content)}>
              {(para, i) => (
                <p style={{ "--i": i }}>
                  <Index each={para().split("\n")}>
                    {(line, k) => (
                      <span>
                        <Show when={k}>
                          <br />
                        </Show>
                        {line()}
                      </span>
                    )}
                  </Index>
                </p>
              )}
            </Index>
          </div>
          <footer class="letter__foot">
            <div class="letter__span">
              <div>
                <Icon name="hourglass" />
                这封信在时间里沉睡了 <b>{fmt.span(openAt() - createdAt())}</b>
              </div>
              <span class="mono">
                {dash(createdAt())} 封存 → {dash(openAt())} 开启
              </span>
            </div>
            <div class="letter__sign">
              <Stamp date={openAt()} />
              <span>—— {props.c.creator.nickname}</span>
            </div>
          </footer>
        </article>
        <Actions c={props.c} letter />
        <Show when={!props.c.inPlaza}>
          <p class="tip tip--quiet">
            <Icon name="lock" />
            <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
          </p>
        </Show>
      </div>
    </>
  );
}

export function AmberCapsulePage(props: { d: CapsuleByCode }) {
  const d = props.d;
  const [phase, setPhase] = createSignal<"" | "shaking" | "open">("");
  const [reveal, setReveal] = createSignal(false);
  // 从动画开始就监听取消信号：换码、换皮肤或离页（视图销毁）后，旧视图停止轮询和通知
  let task: AbortController | null = null;
  onCleanup(() => task?.abort());

  // 开启：胶囊抖动 → 两半分开、迸出一团光 → 信纸自上而下展开，邮戳「啪」地盖上
  createEffect(() => {
    if (!d.expired() || task) return;
    task = new AbortController();
    const { signal } = task;
    void (async () => {
      if (!reducedMotion()) {
        setPhase("shaking");
        window.scrollTo({ top: 0, behavior: "smooth" });
        await sleep(820);
        if (signal.aborted) return;
        setPhase("open");
        await sleep(1150);
        if (signal.aborted) return;
      }
      // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
      if (!(await d.awaitOpened(signal)) || signal.aborted) return; // 离开了页面，或胶囊已被删除
      batch(() => {
        setPhase("");
        setReveal(true);
      });
      toast("胶囊已开启");
    })();
  });

  const opened = () => !!d.c() && d.c()!.isOpened && !phase();
  return (
    <div class="page page--detail">
      <div
        class="container detail"
        data-testid={d.c() ? "capsule-detail" : undefined}
        data-code={d.c()?.code}
        data-state={d.c() ? (opened() ? "opened" : "sealed") : undefined}
        data-in-plaza={d.c() ? String(d.c()!.inPlaza) : undefined}
      >
        <Switch>
          <Match when={d.status() === "error"}>
            <div class="notice card" role="alert">
              <p>暂时无法加载这枚胶囊，请稍后重试。</p>
              <button class="btn btn--ghost" type="button" onClick={() => void d.reload()}>
                重试
              </button>
            </div>
          </Match>
          <Match when={d.status() === "missing"}>
            <div class="notice card" data-testid="detail-not-found">
              <CapsuleArt code="LOST0000" state="opened" width={200} class="notice__art" />
              <div class="eyebrow">Not found</div>
              <h1 class="page-title">找不到这枚胶囊</h1>
              <p class="page-lead">
                <Show when={d.code} fallback="这枚胶囊不存在。">
                  没有胶囊码为 <b class="mono">{d.code.toUpperCase()}</b> 的胶囊。
                </Show>
                也许是码抄错了一位，也许它已经被作者删除了。
              </p>
              <div class="notice__act">
                <a class="btn btn--primary" href="/open">
                  <Icon name="key" />
                  重新输入胶囊码
                </a>
                <a class="btn btn--ghost" href="/">
                  回到广场
                </a>
              </div>
            </div>
          </Match>
          <Match when={d.c() && phase()}>
            <div class={`opening${phase() === "open" ? " is-open" : ""}`}>
              <div class="opening__burst" />
              <div class="opening__capsule">
                <CapsuleArt code={d.c()!.code} state={phase() === "open" ? "opened" : "locked"} width={300} />
              </div>
              <p class="opening__text">时间到了，正在开启……</p>
            </div>
          </Match>
          <Match when={d.c()}>
            {(c) => (
              <Show when={opened()} fallback={<Locked c={c()} now={d.now()} />}>
                <Letter c={c()} reveal={reveal()} />
              </Show>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export function AmberOpenPage(props: { mine: () => CapsuleListItem[] }) {
  const o = useCodeOpen();
  const now = Date.now();
  return (
    <div class="page page--open">
      <div class="container open">
        <header class="page-head page-head--center">
          <div class="eyebrow">Open a capsule</div>
          <h1 class="page-title">开启胶囊</h1>
          <p class="page-lead">输入 8 位胶囊码。到了开启时间，就能读到里面的话；还没到，就陪它一起倒数。</p>
        </header>
        <form
          class="open__form card"
          novalidate
          onSubmit={(e) => {
            e.preventDefault();
            void o.go(o.value());
          }}
        >
          <AmberCodeInput size="lg" state={o.state()} shake={o.shake()} autoFocus value={o.value()} onChange={o.input} onComplete={(v) => void o.go(v)} />
          <div class="open__err" role="alert" data-testid={o.error() ? "open-error" : undefined}>
            {o.error()}
          </div>
          <button class={`btn btn--primary btn--lg${o.state() === "checking" ? " is-busy" : ""}`} type="submit">
            <Icon name="key" />
            开启胶囊
          </button>
          <p class="open__hint">
            胶囊码由 8 位大写字母与数字组成，输入时不区分大小写，可直接粘贴。
            <br />
            没有发布到广场的胶囊，同样可以凭码开启。也可以直接访问 <code class="mono">/capsules/胶囊码</code>。
          </p>
        </form>
        <Show when={auth.user && props.mine().length}>
          <section class="open__list" data-testid="my-sealed">
            <header>
              <h2>我封存过的胶囊</h2>
              <a class="link-btn" href="/me/created">
                全部
                <Icon name="arrow" />
              </a>
            </header>
            <ul>
              <For each={props.mine()}>
                {(c) => (
                  <li>
                    <a
                      class="crow"
                      href={`/capsules/${c.code}`}
                      style={{ "--glow": paletteOf(c.code).glow }}
                      data-testid="my-sealed-item"
                      data-code={c.code}
                      data-state={c.isOpened ? "opened" : "sealed"}
                    >
                      <CapsuleArt code={c.code} state={c.isOpened ? "opened" : "locked"} width={72} />
                      <span class="crow__info">
                        <b>{c.title}</b>
                        <span class="mono">{c.code}</span>
                      </span>
                      <Show when={c.isOpened} fallback={<Badge kind="locked" icon="lock">{cdShort(ms(c.openAt), now)} 后</Badge>}>
                        <Badge kind="opened" icon="mail">
                          已开启
                        </Badge>
                      </Show>
                      <Icon name="chev-right" class="crow__go" />
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
      </div>
    </div>
  );
}
