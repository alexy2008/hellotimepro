// ============================================================
// 「时笺」胶囊详情（/capsules/:code）与开启页（/open）
// 详情三种形态：未启封（信封 + 翻页倒计时 + 刻度尺）→ 启封动画 → 已启封（信笺）
// 结构与类名照 2.0 原型 paper/view-capsule.js
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@/lib/router";
import { fmt, ms, pad2, reducedMotion, sleep } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { toast } from "@/stores/feedback";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import { paragraphs, useMySealed, useShare, type CapsuleView } from "@/hooks/useCapsule";
import { completeCode, useCodeOpen } from "@/hooks/useCodeOpen";
import type { CapsuleDetail } from "@/types";
import { Envelope, FlipDigits, Postmark, Scale, Seal } from "./parts";
import { PaperCodeInput, type CodeInputHandle } from "./CodeInput";

function VisTag({ c }: { c: CapsuleDetail }) {
  return c.inPlaza ? (
    <span className="tag">
      <Icon name="globe" />
      广场公开
    </span>
  ) : (
    <span className="tag tag--quiet">
      <Icon name="lock" />
      仅凭码可见
    </span>
  );
}

function Actions({ c }: { c: CapsuleDetail }) {
  const { copyCode, copyLink } = useShare(c.code);
  return (
    <div className="detail__actions">
      <FavButton capsule={c} size="md" />
      <button className="btn btn--ghost" type="button" data-testid="copy-code" onClick={copyCode}>
        <Icon name="copy" />
        复制胶囊码
      </button>
      <button className="btn btn--ghost" type="button" data-testid="copy-link" onClick={copyLink}>
        <Icon name="link" />
        分享链接
      </button>
    </div>
  );
}

const Back = () => (
  <Link className="back" to="/">
    <Icon name="arrow-left" />
    返回广场
  </Link>
);

function Sealed({ c, now, opening }: { c: CapsuleDetail; now: number; opening: { crack: "whole" | "split" | "cracked"; open: boolean; rising: boolean } | null }) {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  const cd = fmt.cd(openAt, now);
  const p = fmt.progress(createdAt, openAt, now);
  const unit = (v: string, lab: string) => (
    <div className="cd__unit">
      <span className="cd__num latin">
        <FlipDigits value={v} />
      </span>
      <span className="cd__lab">{lab}</span>
    </div>
  );
  return (
    <>
      <Back />
      <header className="detail__head">
        <div className="detail__meta">
          <span className="mono">NO. {c.code}</span>
          <VisTag c={c} />
          <span className="tag tag--seal">
            <Seal ch="封" />
            未开启
          </span>
        </div>
        <h1 className="detail__title" data-testid="detail-title">
          {c.title}
        </h1>
        <div className="detail__by">
          <Avatar id={c.creator.avatarId} />
          <b>{c.creator.nickname}</b>
          <span>
            封存于 {fmt.cn(createdAt)} {fmt.time(createdAt)}
          </span>
        </div>
      </header>

      <section className="stage">
        <div className="stage__pm">
          <Postmark line1={fmt.date(openAt)} line2={`${fmt.time(openAt)} 启`} className="pm--stage" />
        </div>
        <Envelope
          className={`env--stage${opening?.open ? " is-open" : ""}${opening?.rising ? " is-rising" : ""}`}
          crack={opening?.crack ?? "whole"}
          letter={
            <>
              <b>{c.title}</b>
              <i />
              <i />
              <i />
              <i />
            </>
          }
        />
        <div className="stage__floor" />
      </section>

      <section className="cd" aria-live="off" role="timer" data-testid="countdown" data-open-at={c.openAt}
        aria-label={`距离启封还有 ${cd.d} 天 ${cd.h} 小时 ${cd.m} 分 ${cd.s} 秒`}>
        <div className="cd__label">{opening ? "时间到了，正在启封…" : "距离启封还有"}</div>
        <div className="cd__digits">
          {unit(cd.d > 99 ? String(cd.d) : pad2(cd.d), "天")}
          <i className="cd__sep">:</i>
          {unit(pad2(cd.h), "时")}
          <i className="cd__sep">:</i>
          {unit(pad2(cd.m), "分")}
          <i className="cd__sep">:</i>
          {unit(pad2(cd.s), "秒")}
        </div>
        <div className="cd__when">
          将于 <b>{fmt.full(openAt)}</b> 启封
        </div>
      </section>

      <section className="journey">
        <div className="journey__row">
          <span>
            <em>封存</em>
            {fmt.date(createdAt)}
          </span>
          <span className="journey__pct">已等待 {p}%</span>
          <span>
            <em>启封</em>
            {fmt.date(openAt)}
          </span>
        </div>
        <Scale p={p} className="scale--lg" />
      </section>

      <Actions c={c} />
      <p className="note">
        <Icon name="info" />
        <span>未开启的胶囊只显示标题与倒计时。正文会在启封的那一刻，对所有持码的人同时公开。</span>
      </p>
    </>
  );
}

function Opened({ c, reveal }: { c: CapsuleDetail; reveal: boolean }) {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  return (
    <>
      <Back />
      <article className={`letter${reveal ? " letter--reveal" : ""}`}>
        <div className="letter__pm">
          <Postmark line1={fmt.date(openAt)} line2="已 启 封" className="pm--letter" />
        </div>
        <div className="letter__meta">
          <span className="mono">NO. {c.code}</span>
          <VisTag c={c} />
        </div>
        <h1 className="letter__title" data-testid="detail-title">
          {c.title}
        </h1>
        <dl className="letter__facts">
          <div>
            <dt>封存</dt>
            <dd className="mono">{fmt.dateTime(createdAt)}</dd>
          </div>
          <div>
            <dt>启封</dt>
            <dd className="mono">{fmt.dateTime(openAt)}</dd>
          </div>
          <div>
            <dt>在途</dt>
            <dd>{fmt.span(openAt - createdAt)}</dd>
          </div>
        </dl>
        <div className="letter__body" data-testid="detail-content">
          {paragraphs(c.content).map((para, i) => (
            <p key={i} style={{ "--i": i } as CSSProperties}>
              {para.split("\n").map((line, k) => (
                <span key={k}>
                  {k ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          ))}
        </div>
        <footer className="letter__sign">
          <div className="letter__from">
            <span>——</span>
            <Avatar id={c.creator.avatarId} />
            <b>{c.creator.nickname}</b>
          </div>
          <div className="letter__date">写于 {fmt.cn(createdAt)}</div>
          <Seal ch="启" variant="line" className="letter__seal" />
        </footer>
      </article>
      <Actions c={c} />
      {c.inPlaza ? (
        <p className="note note--ok">
          <Icon name="check" />
          <span>这枚胶囊已在广场公开，任何人都可以通过广场或 8 位胶囊码读到它。</span>
        </p>
      ) : (
        <p className="note">
          <Icon name="lock" />
          <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
        </p>
      )}
    </>
  );
}

/** 胶囊详情：数据由路由层的 useCapsuleByCode 给（两套皮肤共用一份，换肤不重取） */
export function PaperCapsulePage({ code, cap }: { code: string; cap: CapsuleView }) {
  const { c, status, now, expired, reload, awaitOpened } = cap;
  const [opening, setOpening] = useState<{ crack: "whole" | "split" | "cracked"; open: boolean; rising: boolean } | null>(null);
  const [host, setHost] = useState("");
  const [reveal, setReveal] = useState(false);
  const openingTask = useRef<AbortController | null>(null);
  useLayoutEffect(() => () => openingTask.current?.abort(), []);

  // 启封：火漆裂开 → 封舌掀起露出朱红内衬 → 信纸升起 → 换成信纸页，字迹逐段显影
  useEffect(() => {
    if (!expired || openingTask.current) return;
    const task = new AbortController();
    openingTask.current = task;
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
      const result = await awaitOpened(signal);
      if (signal.aborted) return;
      setHost("");
      setOpening(null);
      if (!result) return;
      setReveal(true);
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      toast("胶囊已启封");
    })();
  }, [expired, awaitOpened]);

  const opened = !!c && c.isOpened && !opening;
  return (
    <div className="page page--detail">
      <div
        className={`wrap wrap--narrow detail${host ? " " + host : ""}`}
        data-testid={c ? "capsule-detail" : undefined}
        data-code={c?.code}
        data-state={c ? (opened ? "opened" : "sealed") : undefined}
        data-in-plaza={c ? String(c.inPlaza) : undefined}
      >
        {status === "error" ? (
          <div className="lost" role="alert">
            <p>暂时无法加载这枚胶囊，请稍后重试。</p>
            <button className="btn btn--ghost" type="button" onClick={() => void reload()}>重试</button>
          </div>
        ) : status === "missing" ? (
          <div className="lost" data-testid="detail-not-found">
            <div className="lost__mark">
              <Seal ch="无" variant="line" />
            </div>
            <h1 className="h1">查无此信</h1>
            <p>
              {code ? (
                <>
                  没有找到胶囊码为 <b className="mono">{code.toUpperCase()}</b> 的胶囊。
                </>
              ) : (
                "这枚胶囊不存在。"
              )}
              <br />
              它也可能已经被作者删除了。
            </p>
            <div className="lost__act">
              <Link className="btn btn--primary" to="/open">
                <Icon name="key" />
                重新输入胶囊码
              </Link>
              <Link className="btn btn--ghost" to="/">
                回到广场
              </Link>
            </div>
          </div>
        ) : !c ? null : opened ? (
          <Opened c={c} reveal={reveal} />
        ) : (
          <Sealed c={c} now={now} opening={opening} />
        )}
      </div>
    </div>
  );
}

export function PaperOpenPage() {
  const user = useAuth((s) => s.user);
  const mine = useMySealed();
  const { state, error, shake, go, value, input: changeCode } = useCodeOpen();
  const input = useRef<CodeInputHandle>(null);
  const now = Date.now();

  return (
    <div className="page page--open">
      <div className="wrap openp">
        <div className="openp__poem" aria-hidden="true">
          <span>云中谁寄锦书来</span>
          <i />
          <small>李清照 ·《一剪梅》</small>
        </div>
        <section className="openp__main">
          <div className="overline">
            <i />
            Open a capsule
          </div>
          <h1 className="h1">凭码开启</h1>
          <p className="lede">
            输入朋友分享给你的 8 位胶囊码。
            <br />
            如果还没到启封的时刻，你会看到它的倒计时。
          </p>

          <PaperCodeInput
            id="code"
            handle={input}
            state={state}
            shake={shake}
            autoFocus
            value={value}
            onChange={changeCode}
            onComplete={(v) => void go(v)}
          />
          <div className="openp__err" role="alert" data-testid={error ? "open-error" : undefined}>
            {error}
          </div>

          <div className="openp__act">
            <button
              className={`btn btn--primary btn--lg${state === "checking" ? " is-busy" : ""}`}
              type="button"
              disabled={!completeCode(value) || state === "checking"}
              onClick={() => void go(value)}
            >
              <Icon name="key" />
              <span>开启</span>
              <Icon name="arrow" className="ic--go" />
            </button>
            <button
              className="btn btn--ghost btn--lg"
              type="button"
              onClick={async () => {
                try {
                  const t = (await navigator.clipboard.readText()).toUpperCase().replace(/[^A-Z0-9]/g, "");
                  if (!t) return toast("剪贴板里没有胶囊码", { tone: "info" });
                  input.current?.set(t);
                } catch {
                  toast("粘贴失败：请允许浏览器访问剪贴板", { tone: "error" });
                }
              }}
            >
              <Icon name="paste" />
              粘贴识别
            </button>
          </div>

          <ul className="openp__tips">
            <li>
              <Icon name="link" />
              <span>
                也可以直接访问 <code className="mono">/capsules/&lt;胶囊码&gt;</code>
              </span>
            </li>
            <li>
              <Icon name="lock" />
              <span>没有发布到广场的胶囊，同样可以凭码开启</span>
            </li>
          </ul>

          {user && mine.length ? (
            <section className="mylist" data-testid="my-sealed">
              <header>
                <h2 className="serif">我封存过的胶囊</h2>
                <Link className="link" to="/me/created">
                  全部
                  <Icon name="arrow" />
                </Link>
              </header>
              <ul>
                {mine.map((c) => (
                  <li key={c.id}>
                    <Link
                      className="mylist__row"
                      to={`/capsules/${c.code}`}
                      data-testid="my-sealed-item"
                      data-code={c.code}
                      data-state={c.isOpened ? "opened" : "sealed"}
                    >
                      <Seal ch={c.isOpened ? "启" : "封"} variant={c.isOpened ? "line" : "solid"} />
                      <span className="mylist__info">
                        <b className="serif">{c.title}</b>
                        <span className="mono">{c.code}</span>
                      </span>
                      <span className="mylist__st">{c.isOpened ? "已开启" : "距启封 " + fmt.span(ms(c.openAt) - now)}</span>
                      <Icon name="chev-right" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      </div>
    </div>
  );
}
