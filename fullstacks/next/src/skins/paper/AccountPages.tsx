// ============================================================
// 「时笺」登录（/login）· 注册（/register）· 我的（/me/created · /me/favorites · /me/profile）
// 结构与类名照 2.0 原型 paper/view-account.js
// ============================================================

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { fmt, ms, pad2 } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { copyText, toast } from "@/stores/feedback";
import { useNow } from "@/hooks/useNow";
import { ListStatus } from "@/components/shared";
import { nickState, useAvatarIds, useLogin, useMyList, useMyStats, useProfile, useRegister } from "@/hooks/useAccount";
import { AvatarPicker, Field, NickState, PasswordField, PwdRules } from "@/components/forms";
import { ListMore } from "@/components/shared";
import { PaperLogo } from "./Shell";
import { AvatarStamp, Postmark, Scale, Seal } from "./parts";
import { PaperCard } from "./Card";
import { CreateLink } from "@/components/LoginPrompt";

/* ---------------- 登录 / 注册 共用的左侧题字 ---------------- */
function ArtPanel({ poem, src, seal }: { poem: string[]; src: string; seal: string }) {
  return (
    <aside className="auth__art" aria-hidden="true">
      <div className="auth__brand">
        <PaperLogo />
        <span className="latin">HelloTime</span>
      </div>
      <div className="auth__poem serif">
        {poem.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="auth__foot">
        <span>{src}</span>
        <Seal ch={seal} className="auth__seal" />
      </div>
      <div className="auth__pm">
        <Postmark line1={fmt.date(Date.now())} line2="此 刻" className="pm--auth" />
      </div>
    </aside>
  );
}

const withRedirect = (path: string, redirect: string | null) => (redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path);

export function PaperLoginPage() {
  const { email, setEmail, password, setPassword, errors, setErrors, busy, submit, redirect } = useLogin();
  return (
    <div className="page page--auth">
      <div className="auth">
        <ArtPanel poem={["见字如面", "展信安好"]} src="写信的人，在等回信的你" seal="信" />
        <section className="auth__main">
          <div className="auth__card">
            <div className="overline">
              <i />
              Sign in
            </div>
            <h1 className="h1">欢迎回来</h1>
            <p className="lede">你留给未来的信，还在等你开启。</p>
            {redirect ? (
              <p className="note note--inline">
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
              <Field id="email" label="邮箱" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} error={errors.email} testId="login-email" autoFocus />
              <PasswordField
                id="password"
                label="密码"
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
                <Icon name="arrow" className="ic--go" />
              </button>
            </form>
            <p className="auth__alt">
              还没有账号？
              <Link className="link" to={withRedirect("/register", redirect)} data-testid="to-register">
                注册一个
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export function PaperRegisterPage() {
  const { email, setEmail, nickname, setNickname, password, setPassword, avatarId, setAvatarId, errors, busy, submit, redirect } = useRegister();
  const ids = useAvatarIds();
  const ns = nickState(nickname, errors);
  return (
    <div className="page page--auth">
      <div className="auth">
        <ArtPanel poem={["纸短情长", "来日方长"]} src="先留个名字，再慢慢写" seal="缄" />
        <section className="auth__main">
          <div className="auth__card auth__card--wide">
            <div className="overline">
              <i />
              Sign up
            </div>
            <h1 className="h1">领一个信箱</h1>
            <p className="lede">挑一枚邮票当头像，然后写一封最早 1 分钟后才能打开的信。</p>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="form__row">
                <Field id="email" label="邮箱" type="email" autoComplete="email" placeholder="you@example.com" hint="作为登录账号，注册后不可修改。" value={email} onChange={setEmail} error={errors.email} testId="register-email" autoFocus />
                <Field
                  id="nickname"
                  label="昵称"
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
              <PasswordField id="password" label="密码" autoComplete="new-password" placeholder="设置密码" value={password} onChange={setPassword} error={errors.password} testId="register-password" />
              <PwdRules value={password} />
              <div className="field field--plain">
                <span className="field__label">
                  邮票头像 <small>十选一，不支持上传</small>
                </span>
                <AvatarPicker ids={ids} value={avatarId} onChange={setAvatarId} />
              </div>
              <div className="form__err" role="alert">
                {errors.form ?? errors.avatarId}
              </div>
              <button className={`btn btn--primary btn--lg btn--block${busy ? " is-busy" : ""}`} type="submit" disabled={busy} data-testid="register-submit">
                <span>{busy ? "正在创建…" : "创建账号，开始写信"}</span>
                <Icon name="arrow" className="ic--go" />
              </button>
            </form>
            <p className="auth__alt">
              已经有账号？
              <Link className="link" to={withRedirect("/login", redirect)} data-testid="to-login">
                去登录
              </Link>
            </p>
          </div>
        </section>
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

function Created({ now, onChange }: { now: number; onChange: () => void }) {
  const { items, error, reload, total, hasMore, moreBusy, loadMore, remove } = useMyList("created", onChange);
  if (!items) return <ListStatus error={error} retry={reload} />;
  if (!items.length) {
    return (
      <div className="empty empty--inline" data-testid="list-empty">
        <Seal ch="空" variant="line" />
        <h3>还没有写下任何胶囊</h3>
        <p>第一封信，写给一年后的自己怎么样？</p>
        <CreateLink className="btn btn--primary">
          <Icon name="pen" />
          写一枚胶囊
        </CreateLink>
      </div>
    );
  }
  return (
    <>
      <div className="me__bar">
        <span>按创建时间倒序 · 共 {total} 枚</span>
        <CreateLink className="btn btn--primary btn--sm">
          <Icon name="plus" />
          新建胶囊
        </CreateLink>
      </div>
      <ul className="ledger">
        {items.map((c, i) => {
          const openAt = ms(c.openAt), createdAt = ms(c.createdAt);
          const opened = c.isOpened || openAt <= now;
          const cd = fmt.cd(openAt, now);
          return (
            <li
              key={c.id}
              className="ledger__row"
              style={{ "--i": i } as CSSProperties}
              data-testid="my-capsule"
              data-code={c.code}
              data-state={opened ? "opened" : "sealed"}
              data-in-plaza={c.inPlaza}
            >
              <div className="ledger__seal">
                <Seal ch={opened ? "启" : "封"} variant={opened ? "line" : "solid"} />
              </div>
              <div className="ledger__main">
                <Link className="ledger__title serif" to={`/capsules/${c.code}`} data-testid="row-open">
                  {c.title}
                </Link>
                <div className="ledger__sub">
                  <button className="ledger__code mono" type="button" title="点击复制胶囊码" onClick={() => void copyText(c.code, `已复制胶囊码 ${c.code}`)}>
                    {c.code}
                    <Icon name="copy" />
                  </button>
                  {c.inPlaza ? (
                    <span className="tag">
                      <Icon name="globe" />
                      广场公开
                    </span>
                  ) : (
                    <span className="tag tag--quiet">
                      <Icon name="lock" />
                      仅凭码可见
                    </span>
                  )}
                  <span>封存于 {fmt.date(createdAt)}</span>
                </div>
              </div>
              {opened ? (
                <div className="ledger__when">
                  <span className="ledger__k">已启封</span>
                  <b>{fmt.date(openAt)}</b>
                  <small>在途 {fmt.span(openAt - createdAt)}</small>
                </div>
              ) : (
                <div className="ledger__when">
                  <span className="ledger__k">距启封</span>
                  <b>
                    {cd.d > 0 ? (
                      <>
                        <span className="latin">{fmt.num(cd.d)}</span> 天
                      </>
                    ) : (
                      <span className="mono">
                        {pad2(cd.h)}:{pad2(cd.m)}:{pad2(cd.s)}
                      </span>
                    )}
                  </b>
                  <Scale p={fmt.progress(createdAt, openAt, now)} />
                </div>
              )}
              <div className="ledger__fav" title={`被收藏 ${c.favoriteCount} 次`}>
                <Icon name="heart" />
                <span className="latin">{fmt.num(c.favoriteCount)}</span>
              </div>
              <div className="ledger__act">
                <Link className="btn btn--text" to={`/capsules/${c.code}`}>
                  查看
                </Link>
                <button
                  className="btn btn--text btn--danger"
                  type="button"
                  data-testid="delete-capsule"
                  onClick={async () => {
                    const mark = (
                      <div className="dlg__mark">
                        <Seal ch="删" variant="line" />
                      </div>
                    );
                    await remove(c, mark);
                  }}
                >
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <ListMore show={hasMore} busy={moreBusy} left={total - items.length} onMore={() => void loadMore()} />
      <p className="me__fine">
        <Icon name="info" />
        胶囊的内容与启封时刻一经封存就不可修改；你可以随时删除自己写的胶囊，无论它是否已经启封。
      </p>
    </>
  );
}

function Favorites({ now, onChange }: { now: number; onChange: () => void }) {
  const { items, error, reload, total, hasMore, moreBusy, loadMore, onFavChange } = useMyList("favorites", onChange);
  const me = useAuth((s) => s.user);
  if (!items) return <ListStatus error={error} retry={reload} />;
  if (!items.length) {
    return (
      <div className="empty empty--inline" data-testid="list-empty">
        <Seal ch="藏" variant="line" />
        <h3>还没有收藏</h3>
        <p>去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。</p>
        <Link className="btn btn--primary" to="/">
          去广场逛逛
          <Icon name="arrow" className="ic--go" />
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="me__bar">
        <span>按收藏时间倒序 · 共 {total} 枚</span>
        <Link className="btn btn--ghost btn--sm" to="/">
          去广场逛逛
        </Link>
      </div>
      <div className="grid grid--me">
        {items.map((c, i) => (
          <PaperCard
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
      <section className="pane">
        <h2 className="pane__h">基本信息</h2>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.saveProfile().then(onSaved);
          }}
        >
          <Field
            id="p-email"
            label="邮箱"
            type="email"
            value={p.user.email}
            disabled
            hint="邮箱是登录账号，不可修改。"
            trail={
              <span className="field__state is-lock" aria-hidden="true">
                <Icon name="lock" />
              </span>
            }
          />
          <Field
            id="p-nick"
            label="昵称"
            autoComplete="nickname"
            hint={ns.hint ?? "2–20 个字符，全站唯一。"}
            value={p.nickname}
            onChange={p.setNickname}
            error={p.errors.nickname}
            testId="profile-nickname"
            trail={<NickState state={p.nickname.trim() === p.user.nickname ? "" : ns.state} />}
          />
          <div className="field field--plain">
            <span className="field__label">邮票头像</span>
            <AvatarPicker ids={ids} value={p.avatarId} onChange={p.setAvatarId} />
          </div>
          <Msg m={p.msg} />
          <div className="pane__act">
            <button className="btn btn--ghost" type="button" onClick={p.resetProfile}>
              重置
            </button>
            <button className={`btn btn--primary${p.busy ? " is-busy" : ""}`} type="submit" disabled={p.busy} data-testid="profile-save">
              <span>{p.busy ? "保存中…" : "保存更改"}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="pane">
        <h2 className="pane__h">修改密码</h2>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.changePassword();
          }}
        >
          <PasswordField id="pw-cur" label="当前密码" autoComplete="current-password" value={p.pwd.current} onChange={(v) => p.setPwd("current", v)} error={p.errors.current} errorKey="current" testId="pwd-current" />
          <PasswordField id="pw-new" label="新密码" autoComplete="new-password" value={p.pwd.next} onChange={(v) => p.setPwd("next", v)} error={p.errors.next} errorKey="new" testId="pwd-new" />
          <PwdRules value={p.pwd.next} />
          <PasswordField id="pw-again" label="再输一次新密码" autoComplete="new-password" value={p.pwd.confirm} onChange={(v) => p.setPwd("confirm", v)} error={p.errors.confirm} errorKey="confirm" testId="pwd-confirm" />
          <Msg m={p.pwdMsg} />
          <p className="pane__fine">
            <Icon name="info" />
            修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。
          </p>
          <div className="pane__act">
            <button className={`btn btn--primary${p.pwdBusy ? " is-busy" : ""}`} type="submit" disabled={p.pwdBusy} data-testid="pwd-submit">
              <span>{p.pwdBusy ? "更新中…" : "更新密码"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function PaperMePage({ tab }: { tab: Tab }) {
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const now = useNow();
  const { stats, refresh } = useMyStats();
  const nav = useRef<HTMLElement>(null);
  const [ink, setInk] = useState<CSSProperties>({});
  const first = useRef(true);

  // 页签下的墨线：跟着当前页签滑过去
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const a = nav.current?.querySelector<HTMLElement>(".tabs__it.is-active");
      if (a) setInk({ width: a.offsetWidth, transform: `translateX(${a.offsetLeft}px)`, transition: animate ? undefined : "none" });
    };
    place(!first.current);
    first.current = false;
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(() => place(false));
    return () => window.removeEventListener("resize", onResize);
  }, [tab, stats]);

  const it = (key: Tab, label: string, n?: number): ReactNode => (
    <Link
      className={`tabs__it${tab === key ? " is-active" : ""}`}
      to={`/me/${key}`}
      aria-current={tab === key ? "page" : undefined}
      data-testid={`me-tab-${key}`}
      data-count={n}
    >
      {label}
      {n != null ? <sup>{n}</sup> : null}
    </Link>
  );

  return (
    <div className="page page--me">
      <div className="wrap me">
        <header className="me__head">
          <div className="me__id">
            <AvatarStamp id={user.avatarId} className="stamp--lg" />
            <div>
              <div className="overline">
                <i />
                My desk
              </div>
              <h1 className="h1">{user.nickname}</h1>
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
                ["unopened", "还在等待启封"],
                ["favoritesReceived", "被收藏的次数"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} data-testid="me-stat" data-key={k} data-value={stats?.[k] ?? ""}>
                <dd className="latin">{stats ? fmt.num(stats[k]) : "—"}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </header>

        <nav className="tabs" ref={nav} aria-label="我的">
          {it("created", "我创建的", stats?.created)}
          {it("favorites", "我收藏的", stats?.favoritesGiven)}
          {it("profile", "账号设置")}
          <span className="tabs__ink" aria-hidden="true" style={ink} />
          <button
            className="linkbtn tabs__out"
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
        </nav>

        <div className="me__body is-swap" key={pathname} data-tab={tab}>
          {tab === "created" ? <Created now={now} onChange={refresh} /> : tab === "favorites" ? <Favorites now={now} onChange={refresh} /> : <Profile onSaved={refresh} />}
        </div>
      </div>
    </div>
  );
}
