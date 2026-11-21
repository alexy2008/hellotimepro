// ============================================================
// 「琥珀」胶囊详情（/capsules/:code）与开启页（/open）
// 详情是一台小状态机：封存中（进度环 + 翻牌倒计时）→ 开启中（抖动 · 迸光）→ 信笺
// 结构与类名照 2.0 原型 amber/view-capsule.js
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { fmt, ms, reducedMotion, sleep } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { toast } from "@/stores/feedback";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import { paragraphs, useCapsuleByCode, useMySealed, useShare } from "@/hooks/useCapsule";
import { useCodeOpen } from "@/hooks/useCodeOpen";
import type { CapsuleDetail } from "@/types";
import { Badge, CapsuleArt, Countdown, Stamp, cdShort } from "./parts";
import { AmberCodeInput } from "./CodeInput";
import { CreateLink } from "@/components/LoginPrompt";

const RING_C = 2 * Math.PI * 150;
const dash = (iso: number) => fmt.dateTime(iso).replace(/\./g, "-");

const Back = () => (
  <Link className="back" to="/">
    <Icon name="arrow-left" />
    返回广场
  </Link>
);

const VisBadge = ({ c }: { c: CapsuleDetail }) =>
  c.inPlaza ? <Badge kind="plaza" icon="globe">广场公开</Badge> : <Badge kind="private" icon="lock">仅凭码可见</Badge>;

function Actions({ c, letter }: { c: CapsuleDetail; letter?: boolean }) {
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
      {letter ? (
        <CreateLink className="btn btn--primary">
          <Icon name="pen" />
          我也写一枚
        </CreateLink>
      ) : null}
    </div>
  );
}

function Locked({ c, now }: { c: CapsuleDetail; now: number }) {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  const pct = Math.min(100, Math.max(0, ((now - createdAt) / (openAt - createdAt)) * 100));
  return (
    <>
      <Back />
      <section className="vault card" style={{ "--glow": paletteOf(c.code).glow } as CSSProperties}>
        <div className="vault__dial">
          <svg className="vault__ring" viewBox="0 0 340 340" aria-hidden="true">
            <circle className="vault__track" cx="170" cy="170" r="150" />
            <circle
              className="vault__arc"
              cx="170"
              cy="170"
              r="150"
              style={{ strokeDasharray: `${((RING_C * pct) / 100).toFixed(1)} ${RING_C.toFixed(1)}` }}
            />
          </svg>
          <div className="vault__art">
            <CapsuleArt code={c.code} state="locked" width={220} />
          </div>
          <div className="vault__pct">
            <b className="mono">{pct.toFixed(2)}%</b>
            <span>时间已经走过</span>
          </div>
        </div>
        <div className="vault__info">
          <div className="badges">
            <Badge kind="locked" icon="lock">封存中</Badge>
            <VisBadge c={c} />
          </div>
          <h1 className="vault__title" data-testid="detail-title">
            {c.title}
          </h1>
          <div className="vault__by">
            <Avatar id={c.creator.avatarId} />
            来自 <b>{c.creator.nickname}</b> · 封存于 {fmt.cn(createdAt)}
          </div>
          <div className="vault__k">距离开启还有</div>
          <div data-testid="countdown" data-open-at={c.openAt}>
            <Countdown openAt={openAt} now={now} />
          </div>
          <dl className="vault__meta">
            <div>
              <dt>
                <Icon name="calendar" />
                开启时间
              </dt>
              <dd className="mono">{dash(openAt)}</dd>
            </div>
            <div>
              <dt>
                <Icon name="key" />
                胶囊码
              </dt>
              <dd className="mono">{c.code}</dd>
            </div>
            <div>
              <dt>
                <Icon name="heart" />
                在等它的人
              </dt>
              <dd className="mono">{fmt.num(c.favoriteCount)}</dd>
            </div>
          </dl>
          <p className="tip">
            <Icon name="sparkle" />
            <span>不用刷新页面——倒计时归零的那一刻，它会自己打开。</span>
          </p>
          <Actions c={c} />
        </div>
      </section>
    </>
  );
}

function Letter({ c, reveal }: { c: CapsuleDetail; reveal: boolean }) {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  return (
    <>
      <Back />
      <div className={`letter-page${reveal ? " is-reveal" : ""}`}>
        <article className="letter">
          <div className="letter__meta">
            <span className="mono">{c.code}</span>
            <i />
            <VisBadge c={c} />
          </div>
          <h1 className="letter__title" data-testid="detail-title">
            {c.title}
          </h1>
          <div className="letter__from">
            <Avatar id={c.creator.avatarId} />
            {c.creator.nickname} 写于 {fmt.cn(createdAt)}
          </div>
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
          <footer className="letter__foot">
            <div className="letter__span">
              <div>
                <Icon name="hourglass" />
                这封信在时间里沉睡了 <b>{fmt.span(openAt - createdAt)}</b>
              </div>
              <span className="mono">
                {dash(createdAt)} 封存 → {dash(openAt)} 开启
              </span>
            </div>
            <div className="letter__sign">
              <Stamp date={openAt} />
              <span>—— {c.creator.nickname}</span>
            </div>
          </footer>
        </article>
        <Actions c={c} letter />
        {c.inPlaza ? null : (
          <p className="tip tip--quiet">
            <Icon name="lock" />
            <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
          </p>
        )}
      </div>
    </>
  );
}

export function AmberCapsulePage() {
  const { code = "" } = useParams();
  const { c, status, now, expired, reload, awaitOpened } = useCapsuleByCode(code);
  const [phase, setPhase] = useState<"" | "shaking" | "open">("");
  const [reveal, setReveal] = useState(false);
  const openingTask = useRef<AbortController | null>(null);
  useLayoutEffect(() => () => openingTask.current?.abort(), []);

  // 开启：胶囊抖动 → 两半分开、迸出一团光 → 信纸自上而下展开，邮戳「啪」地盖上
  useEffect(() => {
    if (!expired || openingTask.current) return;
    const task = new AbortController();
    openingTask.current = task;
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
      if (!(await awaitOpened(signal)) || signal.aborted) return; // 离开了页面，或胶囊已被删除
      setPhase("");
      setReveal(true);
      toast("胶囊已开启");
    })();
  }, [expired, awaitOpened]);

  const opened = !!c && c.isOpened && !phase;
  return (
    <div className="page page--detail">
      <div
        className="container detail"
        data-testid={c ? "capsule-detail" : undefined}
        data-code={c?.code}
        data-state={c ? (opened ? "opened" : "sealed") : undefined}
        data-in-plaza={c ? String(c.inPlaza) : undefined}
      >
        {status === "error" ? (
          <div className="notice card" role="alert">
            <p>暂时无法加载这枚胶囊，请稍后重试。</p>
            <button className="btn btn--ghost" type="button" onClick={() => void reload()}>重试</button>
          </div>
        ) : status === "missing" ? (
          <div className="notice card" data-testid="detail-not-found">
            <CapsuleArt code="LOST0000" state="opened" width={200} className="notice__art" />
            <div className="eyebrow">Not found</div>
            <h1 className="page-title">找不到这枚胶囊</h1>
            <p className="page-lead">
              {code ? (
                <>
                  没有胶囊码为 <b className="mono">{code.toUpperCase()}</b> 的胶囊。
                </>
              ) : (
                "这枚胶囊不存在。"
              )}
              也许是码抄错了一位，也许它已经被作者删除了。
            </p>
            <div className="notice__act">
              <Link className="btn btn--primary" to="/open">
                <Icon name="key" />
                重新输入胶囊码
              </Link>
              <Link className="btn btn--ghost" to="/">
                回到广场
              </Link>
            </div>
          </div>
        ) : !c ? null : phase ? (
          <div className={`opening${phase === "open" ? " is-open" : ""}`}>
            <div className="opening__burst" />
            <div className="opening__capsule">
              <CapsuleArt code={c.code} state={phase === "open" ? "opened" : "locked"} width={300} />
            </div>
            <p className="opening__text">时间到了，正在开启……</p>
          </div>
        ) : opened ? (
          <Letter c={c} reveal={reveal} />
        ) : (
          <Locked c={c} now={now} />
        )}
      </div>
    </div>
  );
}

export function AmberOpenPage() {
  const user = useAuth((s) => s.user);
  const mine = useMySealed();
  const { state, error, shake, go, value, input: changeCode } = useCodeOpen();
  const now = Date.now();

  return (
    <div className="page page--open">
      <div className="container open">
        <header className="page-head page-head--center">
          <div className="eyebrow">Open a capsule</div>
          <h1 className="page-title">开启胶囊</h1>
          <p className="page-lead">输入 8 位胶囊码。到了开启时间，就能读到里面的话；还没到，就陪它一起倒数。</p>
        </header>
        <form
          className="open__form card"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void go(value);
          }}
        >
          <AmberCodeInput
            size="lg"
            state={state}
            shake={shake}
            autoFocus
            value={value}
            onChange={changeCode}
            onComplete={(v) => void go(v)}
          />
          <div className="open__err" role="alert" data-testid={error ? "open-error" : undefined}>
            {error}
          </div>
          <button className={`btn btn--primary btn--lg${state === "checking" ? " is-busy" : ""}`} type="submit">
            <Icon name="key" />
            开启胶囊
          </button>
          <p className="open__hint">
            胶囊码由 8 位大写字母与数字组成，输入时不区分大小写，可直接粘贴。
            <br />
            没有发布到广场的胶囊，同样可以凭码开启。也可以直接访问 <code className="mono">/capsules/胶囊码</code>。
          </p>
        </form>
        {user && mine.length ? (
          <section className="open__list" data-testid="my-sealed">
            <header>
              <h2>我封存过的胶囊</h2>
              <Link className="link-btn" to="/me/created">
                全部
                <Icon name="arrow" />
              </Link>
            </header>
            <ul>
              {mine.map((c) => (
                <li key={c.id}>
                  <Link
                    className="crow"
                    to={`/capsules/${c.code}`}
                    style={{ "--glow": paletteOf(c.code).glow } as CSSProperties}
                    data-testid="my-sealed-item"
                    data-code={c.code}
                    data-state={c.isOpened ? "opened" : "sealed"}
                  >
                    <CapsuleArt code={c.code} state={c.isOpened ? "opened" : "locked"} width={72} />
                    <span className="crow__info">
                      <b>{c.title}</b>
                      <span className="mono">{c.code}</span>
                    </span>
                    {c.isOpened ? (
                      <Badge kind="opened" icon="mail">已开启</Badge>
                    ) : (
                      <Badge kind="locked" icon="lock">{cdShort(ms(c.openAt), now)} 后</Badge>
                    )}
                    <Icon name="chev-right" className="crow__go" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
