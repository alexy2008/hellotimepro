// ============================================================
// 「琥珀」创建页（/create）
// 左：表单卡（标题 · AI 代笔 · 灵感 · 正文 · 开启时间 · 发布到广场）
// 右：实时预览 + 须知
// 封存后：胶囊合拢，8 位码牌逐个翻出
// 结构与类名照 2.0 原型 amber/view-create.js
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { fmt, pad2, reducedMotion, focusIfIdle } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { useShare } from "@/hooks/useCapsule";
import { DAY, LIMITS, useCreateCapsule } from "@/hooks/useCreateCapsule";
import { useNow } from "@/hooks/useNow";
import type { CapsuleDetail } from "@/types";
import { Badge, CapsuleArt } from "./parts";

const PRESETS = [
  { key: "1m", label: "1 分钟后" },
  { key: "tm", label: "明早 9 点" },
  { key: "1w", label: "一周后" },
  { key: "1mo", label: "一个月后" },
  { key: "1y", label: "一年后" },
  { key: "5y", label: "五年后" },
  { key: "10y", label: "十年后" },
];

const toLocal = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const dash = (t: number) => fmt.dateTime(t).replace(/\./g, "-");

function useShake(key: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!key) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 480);
    return () => clearTimeout(t);
  }, [key]);
  return on ? " is-shake" : "";
}

/* ---------- 封存完成：胶囊合拢，码牌逐个翻出 ---------- */
function Sealed({ c, onAgain }: { c: CapsuleDetail; onAgain: () => void }) {
  const [inn, setIn] = useState(false);
  const { copyCode, copyLink } = useShare(c.code);
  const openAt = new Date(c.openAt).getTime();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setIn(true)));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <section
      className={`sealed card${inn ? " is-in" : ""}`}
      style={{ "--glow": paletteOf(c.code).glow } as CSSProperties}
      data-testid="sealed-receipt"
      data-code={c.code}
    >
      <div className="sealed__art">
        <CapsuleArt code={c.code} state={inn ? "locked" : "opened"} width={260} />
      </div>
      <div className="eyebrow eyebrow--center">Sealed</div>
      <h1 className="page-title">胶囊已封存</h1>
      <p className="page-lead">
        下面这串胶囊码是开启它的钥匙，{c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}
      </p>
      <div className="tiles mono" aria-label={`胶囊码 ${c.code}`} data-testid="sealed-code">
        {Array.from(c.code).map((ch, i) => (
          <span key={i} className={`tile${i === 4 ? " has-gap" : ""}`} style={{ "--i": i } as CSSProperties}>
            {ch}
          </span>
        ))}
      </div>
      <div className="sealed__act">
        <button className="btn btn--primary" type="button" data-testid="copy-code" onClick={copyCode}>
          <Icon name="copy" />
          复制胶囊码
        </button>
        <button className="btn btn--ghost" type="button" data-testid="copy-link" onClick={copyLink}>
          <Icon name="link" />
          复制开启链接
        </button>
      </div>
      <dl className="sealed__meta">
        <div>
          <dt>标题</dt>
          <dd>{c.title}</dd>
        </div>
        <div>
          <dt>开启时间</dt>
          <dd className="mono">{dash(openAt)}</dd>
        </div>
        <div>
          <dt>沉睡时长</dt>
          <dd>{fmt.span(openAt - Date.now())}</dd>
        </div>
        <div>
          <dt>属性</dt>
          <dd>{c.inPlaza ? <Badge kind="plaza" icon="globe">广场公开</Badge> : <Badge kind="private" icon="lock">仅凭码可见</Badge>}</dd>
        </div>
      </dl>
      <div className="sealed__links">
        <Link className="link-btn" to={`/capsules/${c.code}`} data-testid="receipt-view">
          看看它的倒计时
          <Icon name="arrow" />
        </Link>
        <button className="link-btn" type="button" data-testid="receipt-again" onClick={onAgain}>
          再写一枚
          <Icon name="plus" />
        </button>
        <Link className="link-btn" to="/me/created">
          我创建的
          <Icon name="feather" />
        </Link>
      </div>
    </section>
  );
}

export function AmberCreatePage() {
  const me = useAuth((s) => s.user)!;
  const f = useCreateCapsule();
  const now = useNow();
  const titleEl = useRef<HTMLInputElement>(null);
  const contentEl = useRef<HTMLTextAreaElement>(null);
  const titleShake = useShake(f.shake.title);
  const contentShake = useShake(f.shake.content);
  const openShake = useShake(f.shake.openAt);
  const span = f.openAt - now;

  useEffect(() => {
    const t = setTimeout(() => focusIfIdle(titleEl.current), 380);
    return () => clearTimeout(t);
  }, []);

  useLayoutEffect(() => {
    const el = contentEl.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 36 * 8) + "px";
  }, [f.content]);

  // 校验失败：把出错的字段滚到眼前
  useEffect(() => {
    const field = document.querySelector(".field.is-shake");
    field?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    if (f.errors.title) titleEl.current?.focus({ preventScroll: true });
    else if (f.errors.content) contentEl.current?.focus({ preventScroll: true });
  }, [f.shake.title, f.shake.content, f.shake.openAt]);

  if (f.created) {
    return (
      <div className="page page--create">
        <div className="container">
          <Sealed c={f.created} onAgain={f.again} />
        </div>
      </div>
    );
  }

  return (
    <div className="page page--create">
      <div className="container">
        <header className="page-head">
          <div className="eyebrow">Seal a capsule</div>
          <h1 className="page-title">写一枚胶囊</h1>
          <p className="page-lead">写给未来的自己，或者某个还没出现的人。合上之后，在开启时间到来之前，没有任何人能读到它。</p>
        </header>

        <div className="create">
          <form
            className="create__form card"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void f.submit();
            }}
          >
            <div className={`field${titleShake}`} data-field="title">
              <div className="field__head">
                <label className="field__label" htmlFor="title">
                  标题 <em>*</em>
                </label>
                <span className="field__count mono">
                  <b>{Array.from(f.title).length}</b>/60
                </span>
              </div>
              <div className="input-wrap input-wrap--action">
                <input
                  ref={titleEl}
                  className="input"
                  id="title"
                  maxLength={60}
                  autoComplete="off"
                  placeholder="给这枚胶囊起个名字"
                  data-testid="create-title"
                  value={f.title}
                  onChange={(e) => f.setTitle(e.target.value)}
                />
                <button
                  className={`ai-btn${f.aiBusy ? " is-busy" : ""}`}
                  type="button"
                  data-testid="ai-generate"
                  title="让 AI 代写正文并建议开启时间；标题留空时会顺便起个标题"
                  onClick={() => void f.aiWrite()}
                >
                  <Icon name="sparkle" />
                  <span>{f.aiBusy ? "代笔中…" : f.aiDone ? "重新代笔" : "AI 代笔"}</span>
                </button>
              </div>
              <div className="field__error" role="alert" data-testid={f.errors.title ? "field-error" : undefined} data-field="title">
                {f.errors.title}
              </div>
            </div>

            <div className={`recos${f.showRecos ? "" : " is-hidden"}`} data-testid={f.showRecos ? "ai-reco" : undefined}>
              <div className="recos__in">
                <div className="recos__head">
                  <span>
                    <Icon name="sparkle" />
                    没有头绪？从一个灵感开始
                  </span>
                  <button className="link-btn" type="button" data-testid="reco-refresh" disabled={f.recoBusy || f.aiBusy} onClick={() => void f.refreshRecos()}>
                    <Icon name="refresh" />
                    {f.recoBusy ? "换一批中…" : "换一批"}
                  </button>
                </div>
                <div className="recos__list">
                  {f.recos.map((r, i) => (
                    <button
                      key={r.title}
                      className="reco"
                      type="button"
                      style={{ "--i": i } as CSSProperties}
                      data-testid="reco-chip"
                      disabled={f.aiBusy}
                      onClick={() => void f.aiWrite(r.title)}
                    >
                      <b>{r.title}</b>
                      <span>{r.hint}</span>
                      <em>
                        <Icon name="clock" />
                        {fmt.span(r.openInDays * DAY)}后
                      </em>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`field${contentShake}`} data-field="content">
              <div className="field__head">
                <label className="field__label" htmlFor="content">
                  内容 <em>*</em>
                </label>
                <span className="field__count mono">
                  <b>{fmt.num(f.content.length)}</b>/5000
                </span>
              </div>
              <div className={`paper${f.aiBusy ? " is-ai" : ""}${f.aiThinking ? " is-thinking" : ""}`}>
                <textarea
                  ref={contentEl}
                  className="paper__text"
                  id="content"
                  maxLength={5000}
                  rows={9}
                  placeholder={"在这里写下想交给未来的话。\n可以是此刻的天气、正在读的书、一个小小的约定，\n或者只是一句：嘿，你还好吗？"}
                  data-testid="create-content"
                  value={f.content}
                  onChange={(e) => f.setContent(e.target.value)}
                />
                <div className="paper__think" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="field__hint">
                {f.aiNote ? (
                  <span className="ai-note">
                    <Icon name="sparkle" />
                    {f.aiNote}
                  </span>
                ) : null}
              </div>
              <div className="field__error" role="alert" data-testid={f.errors.content ? "field-error" : undefined} data-field="content">
                {f.errors.content}
              </div>
            </div>

            <div className={`field${openShake}`} data-field="openAt">
              <div className="field__head">
                <label className="field__label" htmlFor="openAt">
                  开启时间 <em>*</em>
                </label>
                <span className="field__count">最早 1 分钟后 · 最晚 10 年内</span>
              </div>
              <div className="input-wrap input-wrap--icon">
                <Icon name="calendar" className="input-wrap__icon" />
                <input
                  className="input mono"
                  id="openAt"
                  type="datetime-local"
                  min={toLocal(LIMITS.minOpen())}
                  max={toLocal(LIMITS.maxOpen())}
                  value={toLocal(f.openAt)}
                  data-testid="create-openat"
                  data-value={new Date(f.openAt).toISOString()}
                  onChange={(e) => {
                    const t = new Date(e.target.value).getTime();
                    if (!Number.isNaN(t)) f.setOpenAt(t);
                  }}
                />
              </div>
              <div className="chips">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    className={`chip${f.preset === p.key ? " is-active" : ""}`}
                    type="button"
                    data-testid="openat-preset"
                    data-value={p.key}
                    data-selected={f.preset === p.key}
                    onClick={() => f.pickPreset(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="field__error" role="alert" data-testid={f.errors.openAt ? "field-error" : undefined} data-field="openAt">
                {f.errors.openAt}
              </div>
            </div>

            <label className={`toggle-card${f.inPlaza ? " is-on" : ""}`}>
              <span className="toggle-card__ic">
                <Icon name="globe" />
              </span>
              <span className="toggle-card__txt">
                <b>发布到胶囊广场</b>
                <small>{f.inPlaza ? "标题与昵称公开展示，内容到时间才可见" : "不出现在广场；把胶囊码交给谁，谁才能找到它"}</small>
              </span>
              <input type="checkbox" className="sr-only" checked={f.inPlaza} data-testid="create-in-plaza" onChange={(e) => f.setInPlaza(e.target.checked)} />
              <span className="switch" aria-hidden="true" />
            </label>

            <div className="create__foot">
              <div className="create__sum">
                <Icon name="hourglass" />
                {span > 0 ? (
                  <span>
                    将沉睡 <b>{fmt.span(span)}</b>，于 {fmt.full(f.openAt)} 开启
                  </span>
                ) : (
                  <span>选一个开启的时刻</span>
                )}
              </div>
              <button className={`btn btn--primary btn--lg${f.submitting ? " is-busy" : ""}`} type="submit" disabled={f.submitting} data-testid="create-submit">
                <Icon name="lock" />
                <span>{f.submitting ? "正在封存…" : "封存胶囊"}</span>
              </button>
            </div>
          </form>

          <aside className="create__side">
            <div className="preview card">
              <div className="preview__head">
                <span className="eyebrow">实时预览</span>
                <span className="badge badge--amber">尚未封存</span>
              </div>
              <div className="preview__art">
                <CapsuleArt code={null} state="opened" width={220} />
              </div>
              <h3 className="preview__title">{f.title.trim() || "未命名的胶囊"}</h3>
              <div className="preview__by">
                <Avatar id={me.avatarId} />
                {me.nickname}
              </div>
              <dl className="preview__table">
                <div>
                  <dt>开启时间</dt>
                  <dd className="mono">{dash(f.openAt)}</dd>
                </div>
                <div>
                  <dt>沉睡时长</dt>
                  <dd>{span > 0 ? fmt.span(span) : "—"}</dd>
                </div>
                <div>
                  <dt>正文</dt>
                  <dd>{fmt.num(f.content.length)} 字</dd>
                </div>
              </dl>
              <div className="badges">
                {f.inPlaza ? <Badge kind="plaza" icon="globe">广场公开</Badge> : <Badge kind="private" icon="lock">仅凭码可见</Badge>}
                <Badge kind="amber" icon="clock">{fmt.span(Math.max(span, 0))}后</Badge>
              </div>
            </div>
            <ul className="notes">
              <li>
                <Icon name="key" />
                <span>封存后会得到一串 8 位胶囊码，它是开启胶囊的凭证，也能分享给别人。</span>
              </li>
              <li>
                <Icon name="lock" />
                <span>到开启时间之前，内容对所有人不可见——包括写下它的你。</span>
              </li>
              <li>
                <Icon name="trash" />
                <span>封存后，内容和开启时间都不能再修改；可以在「我创建的」里删除。</span>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
