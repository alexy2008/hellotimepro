// ============================================================
// 「时笺」胶囊详情（/capsules/:code）与开启页（/open）
// 详情三种形态：未启封（信封 + 翻页倒计时 + 刻度尺）→ 启封动画 → 已启封（信笺）
// 结构与类名照 2.0 原型 paper/view-capsule.js
// ============================================================

import { For, Index, Match, Show, Switch, batch, createEffect, createSignal, onCleanup } from "solid-js";
import { fmt, ms, pad2, reducedMotion, sleep } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { toast } from "@/stores/feedback";
import { auth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import { paragraphs, shareOf, type CapsuleByCode } from "@/primitives/capsule";
import { useNow } from "@/primitives/now";
import { isCompleteCode, useCodeOpen } from "@/primitives/codeOpen";
import type { CapsuleDetail, CapsuleListItem } from "@/types";
import { Envelope, FlipDigits, LetterSlip, Postmark, Scale, Seal, type Crack } from "./parts";
import { PaperCodeInput, type CodeInputHandle } from "./CodeInput";

function VisTag(props: { c: CapsuleDetail }) {
  return (
    <Show
      when={props.c.inPlaza}
      fallback={
        <span class="tag tag--quiet">
          <Icon name="lock" />
          仅凭码可见
        </span>
      }
    >
      <span class="tag">
        <Icon name="globe" />
        广场公开
      </span>
    </Show>
  );
}

function Actions(props: { c: CapsuleDetail; onFavChange: CapsuleByCode["updateFavorite"] }) {
  const share = () => shareOf(props.c.code);
  return (
    <div class="detail__actions">
      <FavButton capsule={props.c} size="md" onChange={props.onFavChange} />
      <button class="btn btn--ghost" type="button" data-testid="copy-code" onClick={() => share().copyCode()}>
        <Icon name="copy" />
        复制胶囊码
      </button>
      <button class="btn btn--ghost" type="button" data-testid="copy-link" onClick={() => share().copyLink()}>
        <Icon name="link" />
        分享链接
      </button>
    </div>
  );
}

const Back = () => (
  <a class="back" href="/">
    <Icon name="arrow-left" />
    返回广场
  </a>
);

interface Opening {
  crack: Crack;
  open: boolean;
  rising: boolean;
}

function Sealed(props: { c: CapsuleDetail; onFavChange: CapsuleByCode["updateFavorite"]; now: number; opening: Opening | null }) {
  const openAt = () => ms(props.c.openAt);
  const createdAt = () => ms(props.c.createdAt);
  const cd = () => fmt.cd(openAt(), props.now);
  const p = () => fmt.progress(createdAt(), openAt(), props.now);
  const Unit = (u: { v: string; lab: string }) => (
    <div class="cd__unit">
      <span class="cd__num latin">
        <FlipDigits value={u.v} />
      </span>
      <span class="cd__lab">{u.lab}</span>
    </div>
  );
  return (
    <>
      <Back />
      <header class="detail__head">
        <div class="detail__meta">
          <span class="mono">NO. {props.c.code}</span>
          <VisTag c={props.c} />
          <span class="tag tag--seal">
            <Seal ch="封" />
            未开启
          </span>
        </div>
        <h1 class="detail__title" data-testid="detail-title">
          {props.c.title}
        </h1>
        <div class="detail__by">
          <Avatar id={props.c.creator.avatarId} />
          <b>{props.c.creator.nickname}</b>
          <span>
            封存于 {fmt.cn(createdAt())} {fmt.time(createdAt())}
          </span>
        </div>
      </header>

      <section class="stage">
        <div class="stage__pm">
          <Postmark line1={fmt.date(openAt())} line2={`${fmt.time(openAt())} 启`} class="pm--stage" />
        </div>
        <Envelope
          class={`env--stage${props.opening?.open ? " is-open" : ""}${props.opening?.rising ? " is-rising" : ""}`}
          crack={props.opening?.crack ?? "whole"}
          letter={<LetterSlip title={props.c.title} />}
        />
        <div class="stage__floor" />
      </section>

      <section
        class="cd"
        aria-live="off"
        role="timer"
        data-testid="countdown"
        data-open-at={props.c.openAt}
        aria-label={`距离启封还有 ${cd().d} 天 ${cd().h} 小时 ${cd().m} 分 ${cd().s} 秒`}
      >
        <div class="cd__label">{props.opening ? "时间到了，正在启封…" : "距离启封还有"}</div>
        <div class="cd__digits">
          <Unit v={cd().d > 99 ? String(cd().d) : pad2(cd().d)} lab="天" />
          <i class="cd__sep">:</i>
          <Unit v={pad2(cd().h)} lab="时" />
          <i class="cd__sep">:</i>
          <Unit v={pad2(cd().m)} lab="分" />
          <i class="cd__sep">:</i>
          <Unit v={pad2(cd().s)} lab="秒" />
        </div>
        <div class="cd__when">
          将于 <b>{fmt.full(openAt())}</b> 启封
        </div>
      </section>

      <section class="journey">
        <div class="journey__row">
          <span>
            <em>封存</em>
            {fmt.date(createdAt())}
          </span>
          <span class="journey__pct">已等待 {p()}%</span>
          <span>
            <em>启封</em>
            {fmt.date(openAt())}
          </span>
        </div>
        <Scale p={p()} class="scale--lg" />
      </section>

      <Actions c={props.c} onFavChange={props.onFavChange} />
      <p class="note">
        <Icon name="info" />
        <span>未开启的胶囊只显示标题与倒计时。正文会在启封的那一刻，对所有持码的人同时公开。</span>
      </p>
    </>
  );
}

function Body(props: { content: string | null }) {
  return (
    <div class="letter__body" data-testid="detail-content">
      <Index each={paragraphs(props.content)}>
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
  );
}

function Opened(props: { c: CapsuleDetail; onFavChange: CapsuleByCode["updateFavorite"]; reveal: boolean }) {
  const openAt = () => ms(props.c.openAt);
  const createdAt = () => ms(props.c.createdAt);
  return (
    <>
      <Back />
      <article class={`letter${props.reveal ? " letter--reveal" : ""}`}>
        <div class="letter__pm">
          <Postmark line1={fmt.date(openAt())} line2="已 启 封" class="pm--letter" />
        </div>
        <div class="letter__meta">
          <span class="mono">NO. {props.c.code}</span>
          <VisTag c={props.c} />
        </div>
        <h1 class="letter__title" data-testid="detail-title">
          {props.c.title}
        </h1>
        <dl class="letter__facts">
          <div>
            <dt>封存</dt>
            <dd class="mono">{fmt.dateTime(createdAt())}</dd>
          </div>
          <div>
            <dt>启封</dt>
            <dd class="mono">{fmt.dateTime(openAt())}</dd>
          </div>
          <div>
            <dt>在途</dt>
            <dd>{fmt.span(openAt() - createdAt())}</dd>
          </div>
        </dl>
        <Body content={props.c.content} />
        <footer class="letter__sign">
          <div class="letter__from">
            <span>——</span>
            <Avatar id={props.c.creator.avatarId} />
            <b>{props.c.creator.nickname}</b>
          </div>
          <div class="letter__date">写于 {fmt.cn(createdAt())}</div>
          <Seal ch="启" variant="line" class="letter__seal" />
        </footer>
      </article>
      <Actions c={props.c} onFavChange={props.onFavChange} />
      <Show
        when={props.c.inPlaza}
        fallback={
          <p class="note">
            <Icon name="lock" />
            <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
          </p>
        }
      >
        <p class="note note--ok">
          <Icon name="check" />
          <span>这枚胶囊已在广场公开，任何人都可以通过广场或 8 位胶囊码读到它。</span>
        </p>
      </Show>
    </>
  );
}

export function PaperCapsulePage(props: { d: CapsuleByCode }) {
  const d = props.d;
  const [opening, setOpening] = createSignal<Opening | null>(null);
  const [host, setHost] = createSignal("");
  const [reveal, setReveal] = createSignal(false);
  // 从动画开始就监听取消信号：换码、换皮肤或离页（视图销毁）后，旧视图停止轮询和通知
  let task: AbortController | null = null;
  onCleanup(() => task?.abort());

  // 启封：火漆裂开 → 封舌掀起露出朱红内衬 → 信纸升起 → 换成信纸页，字迹逐段显影
  createEffect(() => {
    if (!d.expired() || task) return;
    task = new AbortController();
    const { signal } = task;
    void (async () => {
      setOpening({ crack: "whole", open: false, rising: false });
      setHost("is-opening");
      if (!reducedMotion()) {
        setOpening({ crack: "split", open: false, rising: false });
        await sleep(60);
        if (signal.aborted) return;
        setOpening({ crack: "cracked", open: false, rising: false });
        await sleep(620);
        if (signal.aborted) return;
        setOpening({ crack: "cracked", open: true, rising: false });
        await sleep(760);
        if (signal.aborted) return;
        setOpening({ crack: "cracked", open: true, rising: true });
        await sleep(900);
        if (signal.aborted) return;
        setHost("is-opening is-leaving");
        await sleep(380);
        if (signal.aborted) return;
      }
      // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
      const result = await d.awaitOpened(signal);
      if (signal.aborted) return;
      batch(() => {
        setHost("");
        setOpening(null);
        setReveal(Boolean(result));
      });
      task = null;
      if (!result) return;
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      toast("胶囊已启封");
    })();
  });

  const opened = () => !!d.c() && d.c()!.isOpened && !opening();
  return (
    <div class="page page--detail">
      <div
        class={`wrap wrap--narrow detail${host() ? " " + host() : ""}`}
        data-testid={d.c() ? "capsule-detail" : undefined}
        data-code={d.c()?.code}
        data-state={d.c() ? (opened() ? "opened" : "sealed") : undefined}
        data-in-plaza={d.c() ? String(d.c()!.inPlaza) : undefined}
      >
        <Switch>
          <Match when={d.status() === "error"}>
            <div class="lost" role="alert">
              <p>暂时无法加载这枚胶囊，请稍后重试。</p>
              <button class="btn btn--ghost" type="button" onClick={() => void d.reload()}>
                重试
              </button>
            </div>
          </Match>
          <Match when={d.status() === "missing"}>
            <div class="lost" data-testid="detail-not-found">
              <div class="lost__mark">
                <Seal ch="无" variant="line" />
              </div>
              <h1 class="h1">查无此信</h1>
              <p>
                <Show when={d.code} fallback="这枚胶囊不存在。">
                  没有找到胶囊码为 <b class="mono">{d.code.toUpperCase()}</b> 的胶囊。
                </Show>
                <br />
                它也可能已经被作者删除了。
              </p>
              <div class="lost__act">
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
          <Match when={d.c()}>
            {(c) => (
              <Show when={opened()} fallback={<Sealed c={c()} onFavChange={d.updateFavorite} now={d.now()} opening={opening()} />}>
                <Opened c={c()} onFavChange={d.updateFavorite} reveal={reveal()} />
              </Show>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export function PaperOpenPage(props: { mine: () => CapsuleListItem[] }) {
  const o = useCodeOpen();
  let input: CodeInputHandle | undefined;
  const now = useNow();

  const paste = async () => {
    try {
      const t = (await navigator.clipboard.readText()).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!t) return toast("剪贴板里没有胶囊码", { tone: "info" });
      input?.set(t);
    } catch {
      toast("粘贴失败：请允许浏览器访问剪贴板", { tone: "error" });
    }
  };

  return (
    <div class="page page--open">
      <div class="wrap openp">
        <div class="openp__poem" aria-hidden="true">
          <span>云中谁寄锦书来</span>
          <i />
          <small>李清照 ·《一剪梅》</small>
        </div>
        <section class="openp__main">
          <div class="overline">
            <i />
            Open a capsule
          </div>
          <h1 class="h1">凭码开启</h1>
          <p class="lede">
            输入朋友分享给你的 8 位胶囊码。
            <br />
            如果还没到启封的时刻，你会看到它的倒计时。
          </p>

          <PaperCodeInput
            id="code"
            handle={(h) => (input = h)}
            state={o.state()}
            shake={o.shake()}
            autoFocus
            value={o.value()}
            onChange={o.input}
            onComplete={(v) => void o.go(v)}
          />
          <div class="openp__err" role="alert" data-testid={o.error() ? "open-error" : undefined}>
            {o.error()}
          </div>

          <div class="openp__act">
            <button
              class={`btn btn--primary btn--lg${o.state() === "checking" ? " is-busy" : ""}`}
              type="button"
              disabled={!isCompleteCode(o.value()) || o.state() === "checking"}
              onClick={() => void o.go(o.value())}
            >
              <Icon name="key" />
              <span>开启</span>
              <Icon name="arrow" class="ic--go" />
            </button>
            <button class="btn btn--ghost btn--lg" type="button" onClick={() => void paste()}>
              <Icon name="paste" />
              粘贴识别
            </button>
          </div>

          <ul class="openp__tips">
            <li>
              <Icon name="link" />
              <span>
                也可以直接访问 <code class="mono">/capsules/&lt;胶囊码&gt;</code>
              </span>
            </li>
            <li>
              <Icon name="lock" />
              <span>没有发布到广场的胶囊，同样可以凭码开启</span>
            </li>
          </ul>

          <Show when={auth.user && props.mine().length}>
            <section class="mylist" data-testid="my-sealed">
              <header>
                <h2 class="serif">我封存过的胶囊</h2>
                <a class="link" href="/me/created">
                  全部
                  <Icon name="arrow" />
                </a>
              </header>
              <ul>
                <For each={props.mine()}>
                  {(c) => (
                    <li>
                      <a
                        class="mylist__row"
                        href={`/capsules/${c.code}`}
                        data-testid="my-sealed-item"
                        data-code={c.code}
                        data-state={c.isOpened ? "opened" : "sealed"}
                      >
                        <Seal ch={c.isOpened ? "启" : "封"} variant={c.isOpened ? "line" : "solid"} />
                        <span class="mylist__info">
                          <b class="serif">{c.title}</b>
                          <span class="mono">{c.code}</span>
                        </span>
                        <span class="mylist__st">{c.isOpened ? "已开启" : "距启封 " + fmt.span(ms(c.openAt) - now())}</span>
                        <Icon name="chev-right" />
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>
        </section>
      </div>
    </div>
  );
}
