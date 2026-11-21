// ============================================================
// 「琥珀」登录（/login）· 注册（/register）· 我的（/me/created · /me/favorites · /me/profile）
// 结构与类名照 2.0 原型 amber/view-account.js
// ============================================================

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { fmt, ms } from "@/lib/fmt";
import { Icon, type IconName } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { useAuth } from "@/stores/auth";
import { copyText, toast } from "@/stores/feedback";
import { useNow } from "@/hooks/useNow";
import { nickState, useAvatarIds, useLogin, useMyList, useMyStats, useProfile, useRegister } from "@/hooks/useAccount";
import { AvatarPicker, Field, NickState, PasswordField, PwdRules } from "@/components/forms";
import { Avatar, ListMore } from "@/components/shared";
import { Badge, CapsuleArt, cdShort } from "./parts";
import { AmberCard } from "./Card";
import { CreateLink } from "@/components/LoginPrompt";

/** 登录 / 注册卡片顶上的小景：一枚在轨道上缓缓转动的胶囊 */
const AuthArt = ({ state }: { state: "locked" | "opened" }) => (
  <div className="auth__art" aria-hidden="true">
    <span className="auth__orbit" />
    <span className="auth__orbit auth__orbit--2" />
    <CapsuleArt code={null} state={state} width={180} />
  </div>
);

const withRedirect = (path: string, redirect: string | null) => (redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path);

export function AmberLoginPage() {
  const { email, setEmail, password, setPassword, errors, setErrors, busy, submit, redirect } = useLogin();
  return (
    <div className="page page--auth">
      <div className="container auth">
        <div className="auth__card card">
          <AuthArt state="locked" />
          <div className="eyebrow eyebrow--center">Welcome back</div>
          <h1 className="page-title">欢迎回来</h1>
          <p className="page-lead">你封存的胶囊，还在等你回来开启。</p>
          {redirect ? (
            <p className="tip">
              <Icon name="info" />
              <span>登录后会带你回到刚才的页面。</span>
            </p>
          ) : null}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            onInput={() => errors.form && setErrors({})}
          >
            <Field id="email" label="邮箱" type="email" lead="mail" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} error={errors.email} testId="login-email" autoFocus />
            <PasswordField
              id="password"
              label="密码"
              lead="lock"
              autoComplete="current-password"
              placeholder="输入密码"
              hint="忘记密码？当前版本暂不支持找回。"
              value={password}
              onChange={setPassword}
              error={errors.password}
              testId="login-password"
            />
            <div className="form__err" role="alert" data-testid={errors.form ? "login-error" : undefined}>
              {errors.form}
            </div>
            <button className={`btn btn--primary btn--lg btn--block${busy ? " is-busy" : ""}`} type="submit" disabled={busy} data-testid="login-submit">
              <span>{busy ? "登录中…" : "登录"}</span>
              <Icon name="arrow" />
            </button>
          </form>
          <p className="auth__alt">
            还没有账号？
            <Link to={withRedirect("/register", redirect)} data-testid="to-register">
              注册一个
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function AmberRegisterPage() {
  const { email, setEmail, nickname, setNickname, password, setPassword, avatarId, setAvatarId, errors, busy, submit, redirect } = useRegister();
  const ids = useAvatarIds();
  const ns = nickState(nickname, errors);
  return (
    <div className="page page--auth">
      <div className="container auth">
        <div className="auth__card auth__card--wide card">
          <AuthArt state="opened" />
          <div className="eyebrow eyebrow--center">Create account</div>
          <h1 className="page-title">领一个身份</h1>
          <p className="page-lead">挑一颗星球当头像，然后写下你的第一枚胶囊。</p>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="form__row">
              <Field id="email" label="邮箱" type="email" lead="mail" req autoComplete="email" placeholder="you@example.com" hint="作为登录账号，注册后不可修改。" value={email} onChange={setEmail} error={errors.email} testId="register-email" autoFocus />
              <Field
                id="nickname"
                label="昵称"
                lead="user"
                req
                autoComplete="nickname"
                placeholder="2–20 个字符"
                hint={ns.hint ?? "全站唯一，注册后可以改。"}
                value={nickname}
                onChange={setNickname}
                error={errors.nickname ?? (ns.state === "invalid" ? ns.hint : undefined)}
                testId="register-nickname"
                trail={<NickState state={ns.state} />}
              />
            </div>
            <PasswordField id="password" label="密码" lead="lock" req autoComplete="new-password" placeholder="设置密码" value={password} onChange={setPassword} error={errors.password} testId="register-password" />
            <PwdRules value={password} />
            <div className="field field--plain">
              <div className="field__head">
                <span className="field__label">
                  头像 <em>*</em>
                </span>
                <span className="field__count">十选一，不支持上传</span>
              </div>
              <AvatarPicker ids={ids} value={avatarId} onChange={setAvatarId} />
            </div>
            <div className="form__err" role="alert">
              {errors.form ?? errors.avatarId}
            </div>
            <button className={`btn btn--primary btn--lg btn--block${busy ? " is-busy" : ""}`} type="submit" disabled={busy} data-testid="register-submit">
              <span>{busy ? "正在创建…" : "创建账号，开始写胶囊"}</span>
              <Icon name="arrow" />
            </button>
          </form>
          <p className="auth__alt">
            已经有账号？
            <Link to={withRedirect("/login", redirect)} data-testid="to-login">
              去登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 我的 ---------------- */

type Tab = "created" | "favorites" | "profile";

function Msg({ m }: { m: { type: string; text: string } | null }) {
  return (
    <div className={`form__msg${m ? " is-" + m.type : ""}`} role="status">
      {m ? (
        <>
          <Icon name={m.type === "err" ? "alert" : m.type === "ok" ? "check" : "info"} />
          <span>{m.text}</span>
        </>
      ) : null}
    </div>
  );
}

const Empty = ({ state, title, text, action }: { state: "locked" | "opened"; title: string; text: string; action: React.ReactNode }) => (
  <div className="empty" data-testid="list-empty">
    <CapsuleArt code={null} state={state} width={170} className="empty__art" />
    <h3 className="empty__title">{title}</h3>
    <p>{text}</p>
    {action}
  </div>
);

function Created({ now, onChange }: { now: number; onChange: () => void }) {
  const { items, total, hasMore, moreBusy, loadMore, remove } = useMyList("created", onChange);
  if (!items) return null;
  if (!items.length) {
    return (
      <Empty
        state="opened"
        title="还没有写下任何胶囊"
        text="第一枚，写给一年后的自己怎么样？"
        action={
          <CreateLink className="btn btn--primary">
            <Icon name="pen" />
            写一枚胶囊
          </CreateLink>
        }
      />
    );
  }
  return (
    <>
      <div className="me__sub">
        <span>按创建时间倒序 · 共 {total} 枚</span>
        <CreateLink className="btn btn--primary btn--sm">
          <Icon name="plus" />
          写一枚
        </CreateLink>
      </div>
      <ul className="ledger">
        {items.map((c, i) => {
          const openAt = ms(c.openAt), createdAt = ms(c.createdAt);
          const opened = c.isOpened || openAt <= now;
          return (
            <li
              key={c.id}
              className="ledger__row"
              style={{ "--i": i, "--glow": paletteOf(c.code).glow } as CSSProperties}
              data-testid="my-capsule"
              data-code={c.code}
              data-state={opened ? "opened" : "sealed"}
              data-in-plaza={c.inPlaza}
            >
              <Link className="ledger__art" to={`/capsules/${c.code}`} tabIndex={-1} aria-hidden="true">
                <CapsuleArt code={c.code} state={opened ? "opened" : "locked"} width={112} />
              </Link>
              <div className="ledger__main">
                <Link className="ledger__title" to={`/capsules/${c.code}`} data-testid="row-open">
                  {c.title}
                </Link>
                <div className="ledger__sub">
                  <button className="ledger__code mono" type="button" title="点击复制胶囊码" onClick={() => void copyText(c.code, `已复制胶囊码 ${c.code}`)}>
                    {c.code}
                    <Icon name="copy" />
                  </button>
                  {c.inPlaza ? <Badge kind="plaza" icon="globe">广场公开</Badge> : <Badge kind="private" icon="lock">仅凭码可见</Badge>}
                  <span>封存于 {fmt.date(createdAt)}</span>
                </div>
              </div>
              <div className="ledger__when">
                {opened ? (
                  <>
                    <Badge kind="opened" icon="mail">已开启</Badge>
                    <span>
                      {fmt.date(openAt)} · 沉睡 {fmt.span(openAt - createdAt)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="ledger__cd">
                      <Icon name="hourglass" />
                      <b className="mono">{cdShort(openAt, now)}</b>
                    </span>
                    <div className="pc__progress">
                      <span style={{ width: `${Math.max(2, fmt.progress(createdAt, openAt, now))}%` }} />
                    </div>
                  </>
                )}
              </div>
              <div className="ledger__fav" title={`被收藏 ${c.favoriteCount} 次`}>
                <Icon name="heart" />
                <span className="mono">{fmt.num(c.favoriteCount)}</span>
              </div>
              <div className="ledger__act">
                <Link className="btn btn--ghost btn--sm" to={`/capsules/${c.code}`}>
                  查看
                </Link>
                <button
                  className="btn btn--danger-ghost btn--sm"
                  type="button"
                  data-testid="delete-capsule"
                  onClick={() =>
                    void remove(
                      c,
                      <div className="dlg__art">
                        <CapsuleArt code={c.code} state="opened" width={120} />
                      </div>,
                    )
                  }
                >
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <ListMore show={hasMore} busy={moreBusy} left={total - items.length} onMore={() => void loadMore()} />
      <p className="tip tip--quiet">
        <Icon name="info" />
        <span>胶囊的内容与开启时间封存后不可修改；你可以随时删除自己写的胶囊，无论它是否已经开启。</span>
      </p>
    </>
  );
}

function Favorites({ now, onChange }: { now: number; onChange: () => void }) {
  const { items, total, hasMore, moreBusy, loadMore, onFavChange } = useMyList("favorites", onChange);
  const me = useAuth((s) => s.user);
  if (!items) return null;
  if (!items.length) {
    return (
      <Empty
        state="locked"
        title="还没有收藏"
        text="去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。"
        action={
          <Link className="btn btn--primary" to="/">
            去广场逛逛
            <Icon name="arrow" />
          </Link>
        }
      />
    );
  }
  return (
    <>
      <div className="me__sub">
        <span>按收藏时间倒序 · 共 {total} 枚</span>
        <Link className="btn btn--ghost btn--sm" to="/">
          去广场逛逛
        </Link>
      </div>
      <div className="grid">
        {items.map((c, i) => (
          <AmberCard
            key={c.id}
            c={c}
            i={i}
            now={now}
            mine={me?.nickname === c.creator.nickname}
            testId="fav-item"
            openTestId="row-open"
            onFavChange={(f) => onFavChange(c.id, f)}
          />
        ))}
      </div>
      <ListMore show={hasMore} busy={moreBusy} left={total - items.length} onMore={() => void loadMore()} />
    </>
  );
}

function Profile({ onSaved }: { onSaved: () => void }) {
  const p = useProfile();
  const ids = useAvatarIds();
  const ns = nickState(p.nickname, p.errors);
  return (
    <div className="profile">
      <section className="card card--pad">
        <div className="eyebrow">Profile</div>
        <h2 className="card__title">基本信息</h2>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.saveProfile().then(onSaved);
          }}
        >
          <Field id="p-email" label="邮箱" type="email" lead="mail" value={p.user.email} disabled hint="邮箱是登录账号，不可修改。" />
          <Field
            id="p-nick"
            label="昵称"
            lead="user"
            autoComplete="nickname"
            hint={ns.hint ?? "2–20 个字符，全站唯一。"}
            value={p.nickname}
            onChange={p.setNickname}
            error={p.errors.nickname}
            testId="profile-nickname"
            trail={<NickState state={p.nickname.trim() === p.user.nickname ? "" : ns.state} />}
          />
          <div className="field field--plain">
            <div className="field__head">
              <span className="field__label">头像</span>
            </div>
            <AvatarPicker ids={ids} value={p.avatarId} onChange={p.setAvatarId} />
          </div>
          <Msg m={p.msg} />
          <div className="card__act">
            <button className="btn btn--ghost" type="button" onClick={p.resetProfile}>
              重置
            </button>
            <button className={`btn btn--primary${p.busy ? " is-busy" : ""}`} type="submit" disabled={p.busy} data-testid="profile-save">
              <span>{p.busy ? "保存中…" : "保存更改"}</span>
            </button>
          </div>
        </form>
      </section>
      <section className="card card--pad">
        <div className="eyebrow">Security</div>
        <h2 className="card__title">修改密码</h2>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.changePassword();
          }}
        >
          <PasswordField id="pw-cur" label="当前密码" lead="lock" autoComplete="current-password" value={p.pwd.current} onChange={(v) => p.setPwd("current", v)} error={p.errors.current} errorKey="current" testId="pwd-current" />
          <PasswordField id="pw-new" label="新密码" lead="key" autoComplete="new-password" value={p.pwd.next} onChange={(v) => p.setPwd("next", v)} error={p.errors.next} errorKey="new" testId="pwd-new" />
          <PwdRules value={p.pwd.next} />
          <PasswordField id="pw-again" label="再输一次新密码" lead="key" autoComplete="new-password" value={p.pwd.confirm} onChange={(v) => p.setPwd("confirm", v)} error={p.errors.confirm} errorKey="confirm" testId="pwd-confirm" />
          <Msg m={p.pwdMsg} />
          <p className="tip tip--quiet">
            <Icon name="shield" />
            <span>修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。</span>
          </p>
          <div className="card__act">
            <button className={`btn btn--primary${p.pwdBusy ? " is-busy" : ""}`} type="submit" disabled={p.pwdBusy} data-testid="pwd-submit">
              <span>{p.pwdBusy ? "更新中…" : "更新密码"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function AmberMePage({ tab }: { tab: Tab }) {
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const now = useNow();
  const { stats, refresh } = useMyStats();

  return (
    <div className="page page--me">
      <div className="container me">
        <header className="me__head card">
          <div className="me__id">
            <div className="me__orb">
              <Avatar id={user.avatarId} className="av--hero" />
              <span className="me__ring" />
            </div>
            <div>
              <div className="eyebrow">My capsules</div>
              <h1 className="page-title">{user.nickname}</h1>
              <p className="me__mail">
                <span className="mono">{user.email}</span>
                <span>{fmt.cn(ms(user.createdAt))} 加入</span>
              </p>
            </div>
          </div>
          <dl className="me__stats">
            {(
              [
                ["created", "写下的胶囊"],
                ["unopened", "还在封存中"],
                ["favoritesReceived", "被收藏的次数"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} data-testid="me-stat" data-key={k} data-value={stats?.[k] ?? ""}>
                <dd className="mono">{stats ? fmt.num(stats[k]) : "—"}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </header>

        <div className="me__bar">
          <MeTabs tab={tab} created={stats?.created} favorites={stats?.favoritesGiven} />
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={async () => {
              await logout(true);
              toast("已登出");
              navigate("/");
            }}
          >
            <Icon name="logout" />
            登出
          </button>
        </div>

        <div className="me__body is-swap" key={pathname} data-tab={tab}>
          {tab === "created" ? <Created now={now} onChange={refresh} /> : tab === "favorites" ? <Favorites now={now} onChange={refresh} /> : <Profile onSaved={refresh} />}
        </div>
      </div>
    </div>
  );
}

/** 「我的」页签：一枚大号分段控件，每一项是链接，滑块跟着当前页签 */
function MeTabs({ tab, created, favorites }: { tab: Tab; created?: number; favorites?: number }) {
  const box = useRef<HTMLElement>(null);
  const [thumb, setThumb] = useState<CSSProperties>({});
  const first = useRef(true);
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const a = box.current?.querySelector<HTMLElement>(".seg__opt.is-active");
      if (a) setThumb({ width: a.offsetWidth, transform: `translateX(${a.offsetLeft}px)`, transition: animate ? undefined : "none" });
    };
    place(!first.current);
    first.current = false;
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(() => place(false));
    return () => window.removeEventListener("resize", onResize);
  }, [tab, created, favorites]);
  const it = (key: Tab, icon: IconName, label: string, n?: number) => (
    <Link
      className={`seg__opt${tab === key ? " is-active" : ""}`}
      to={`/me/${key}`}
      aria-current={tab === key ? "page" : undefined}
      data-testid={`me-tab-${key}`}
      data-count={n}
    >
      <Icon name={icon} />
      {label}
      {n != null ? <sup>{n}</sup> : null}
    </Link>
  );
  return (
    <nav className="seg seg--lg" ref={box} aria-label="我的">
      <span className="seg__thumb" style={thumb} />
      {it("created", "feather", "我创建的", created)}
      {it("favorites", "heart", "我收藏的", favorites)}
      {it("profile", "sliders", "账号设置")}
    </nav>
  );
}
