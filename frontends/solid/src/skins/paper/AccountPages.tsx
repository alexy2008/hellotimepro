// ============================================================
// 「时笺」登录（/login）· 注册（/register）· 我的（/me/created · /me/favorites · /me/profile）
// 结构与类名照 2.0 原型 paper/view-account.js
// 表单状态都由路由页创建后传进来（f / body），这里只负责画出来
// ============================================================

import { For, Match, Show, Switch, type Accessor, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { fmt, ms, pad2 } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { auth, logout } from "@/stores/auth";
import { copyText, toast } from "@/stores/feedback";
import { useNow } from "@/primitives/now";
import type { LoginForm, MyList, MyStatsState, ProfileForm, RegisterForm } from "@/primitives/account";
import { AvatarPicker, Field, NickState, PasswordField, PwdRules } from "@/components/forms";
import { FormMsg, ListMore } from "@/components/shared";
import { CreateLink } from "@/components/LoginPrompt";
import { createSlider } from "@/components/Seg";
import type { MeBody, MeTab } from "@/pages/MePage";
import { PaperLogo } from "./Shell";
import { AvatarStamp, Postmark, Scale, Seal } from "./parts";
import { PaperCard } from "./Card";

/* ---------------- 登录 / 注册 共用的左侧题字 ---------------- */
function ArtPanel(props: { poem: string[]; src: string; seal: string }) {
  return (
    <aside class="auth__art" aria-hidden="true">
      <div class="auth__brand">
        <PaperLogo />
        <span class="latin">HelloTime</span>
      </div>
      <div class="auth__poem serif">
        <For each={props.poem}>{(l) => <span>{l}</span>}</For>
      </div>
      <div class="auth__foot">
        <span>{props.src}</span>
        <Seal ch={props.seal} class="auth__seal" />
      </div>
      <div class="auth__pm">
        <Postmark line1={fmt.date(Date.now())} line2="此 刻" class="pm--auth" />
      </div>
    </aside>
  );
}

const withRedirect = (path: string, redirect: string | null) => (redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path);

export function PaperLoginPage(props: { f: LoginForm }) {
  const f = props.f;
  return (
    <div class="page page--auth">
      <div class="auth">
        <ArtPanel poem={["见字如面", "展信安好"]} src="写信的人，在等回信的你" seal="信" />
        <section class="auth__main">
          <div class="auth__card">
            <div class="overline">
              <i />
              Sign in
            </div>
            <h1 class="h1">欢迎回来</h1>
            <p class="lede">你留给未来的信，还在等你开启。</p>
            <Show when={f.redirect()}>
              <p class="note note--inline">
                <Icon name="info" />
                <span>登录后会带你回到刚才的页面。</span>
              </p>
            </Show>
            <form
              novalidate
              onSubmit={(e) => {
                e.preventDefault();
                void f.submit();
              }}
              onInput={() => f.errors().form && f.setErrors({})}
            >
              <Field id="email" label="邮箱" type="email" autoComplete="email" placeholder="you@example.com" value={f.email()} onChange={f.setEmail} error={f.errors().email} testId="login-email" autoFocus />
              <PasswordField
                id="password"
                label="密码"
                autoComplete="current-password"
                placeholder="输入密码"
                hint="忘记密码？当前版本暂不支持找回。"
                value={f.password()}
                onChange={f.setPassword}
                error={f.errors().password}
                testId="login-password"
              />
              <div class="form__err" role="alert" data-testid={f.errors().form ? "login-error" : undefined}>
                {f.errors().form}
              </div>
              <button class={`btn btn--primary btn--lg btn--block${f.busy() ? " is-busy" : ""}`} type="submit" disabled={f.busy()} data-testid="login-submit">
                <span>{f.busy() ? "登录中…" : "登录"}</span>
                <Icon name="arrow" class="ic--go" />
              </button>
            </form>
            <p class="auth__alt">
              还没有账号？
              <a class="link" href={withRedirect("/register", f.redirect())} data-testid="to-register">
                注册一个
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export function PaperRegisterPage(props: { f: RegisterForm; ids: Accessor<string[]> }) {
  const f = props.f;
  return (
    <div class="page page--auth">
      <div class="auth">
        <ArtPanel poem={["纸短情长", "来日方长"]} src="先留个名字，再慢慢写" seal="缄" />
        <section class="auth__main">
          <div class="auth__card auth__card--wide">
            <div class="overline">
              <i />
              Sign up
            </div>
            <h1 class="h1">领一个信箱</h1>
            <p class="lede">挑一枚邮票当头像，然后写一封最早 1 分钟后才能打开的信。</p>
            <form
              novalidate
              onSubmit={(e) => {
                e.preventDefault();
                void f.submit();
              }}
            >
              <div class="form__row">
                <Field id="email" label="邮箱" type="email" autoComplete="email" placeholder="you@example.com" hint="作为登录账号，注册后不可修改。" value={f.email()} onChange={f.setEmail} error={f.errors().email} testId="register-email" autoFocus />
                <Field
                  id="nickname"
                  label="昵称"
                  autoComplete="nickname"
                  placeholder="2–20 个字符"
                  hint={f.nick().hint ?? "全站唯一，注册后可以改。"}
                  value={f.nickname()}
                  onChange={f.setNickname}
                  error={f.errors().nickname ?? (f.nick().state === "invalid" ? f.nick().hint : undefined)}
                  testId="register-nickname"
                  trail={<NickState state={f.nick().state} />}
                />
              </div>
              <PasswordField id="password" label="密码" autoComplete="new-password" placeholder="设置密码" value={f.password()} onChange={f.setPassword} error={f.errors().password} testId="register-password" />
              <PwdRules value={f.password()} />
              <div class="field field--plain">
                <span class="field__label">
                  邮票头像 <small>十选一，不支持上传</small>
                </span>
                <AvatarPicker ids={props.ids()} value={f.avatarId()} onChange={f.setAvatarId} />
              </div>
              <div class="form__err" role="alert">
                {f.errors().form ?? f.errors().avatarId}
              </div>
              <button class={`btn btn--primary btn--lg btn--block${f.busy() ? " is-busy" : ""}`} type="submit" disabled={f.busy()} data-testid="register-submit">
                <span>{f.busy() ? "正在创建…" : "创建账号，开始写信"}</span>
                <Icon name="arrow" class="ic--go" />
              </button>
            </form>
            <p class="auth__alt">
              已经有账号？
              <a class="link" href={withRedirect("/login", f.redirect())} data-testid="to-login">
                去登录
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- 我的 ---------------- */

const VisTag = (props: { inPlaza: boolean }) => (
  <Show
    when={props.inPlaza}
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

function Created(props: { list: MyList; now: number }) {
  const l = props.list;
  return (
    <Show when={l.items()}>
      {(items) => (
        <Show
          when={items().length}
          fallback={
            <div class="empty empty--inline" data-testid="list-empty">
              <Seal ch="空" variant="line" />
              <h3>还没有写下任何胶囊</h3>
              <p>第一封信，写给一年后的自己怎么样？</p>
              <CreateLink class="btn btn--primary">
                <Icon name="pen" />
                写一枚胶囊
              </CreateLink>
            </div>
          }
        >
          <div class="me__bar">
            <span>按创建时间倒序 · 共 {l.total()} 枚</span>
            <CreateLink class="btn btn--primary btn--sm">
              <Icon name="plus" />
              新建胶囊
            </CreateLink>
          </div>
          <ul class="ledger">
            <For each={items()}>
              {(c, i) => {
                const openAt = ms(c.openAt),
                  createdAt = ms(c.createdAt);
                const opened = () => c.isOpened || openAt <= props.now;
                const cd = () => fmt.cd(openAt, props.now);
                return (
                  <li
                    class="ledger__row"
                    style={{ "--i": i() }}
                    data-testid="my-capsule"
                    data-code={c.code}
                    data-state={opened() ? "opened" : "sealed"}
                    data-in-plaza={String(c.inPlaza)}
                  >
                    <div class="ledger__seal">
                      <Seal ch={opened() ? "启" : "封"} variant={opened() ? "line" : "solid"} />
                    </div>
                    <div class="ledger__main">
                      <a class="ledger__title serif" href={`/capsules/${c.code}`} data-testid="row-open">
                        {c.title}
                      </a>
                      <div class="ledger__sub">
                        <button class="ledger__code mono" type="button" title="点击复制胶囊码" onClick={() => void copyText(c.code, `已复制胶囊码 ${c.code}`)}>
                          {c.code}
                          <Icon name="copy" />
                        </button>
                        <VisTag inPlaza={c.inPlaza} />
                        <span>封存于 {fmt.date(createdAt)}</span>
                      </div>
                    </div>
                    <Show
                      when={opened()}
                      fallback={
                        <div class="ledger__when">
                          <span class="ledger__k">距启封</span>
                          <b>
                            <Show
                              when={cd().d > 0}
                              fallback={
                                <span class="mono">
                                  {pad2(cd().h)}:{pad2(cd().m)}:{pad2(cd().s)}
                                </span>
                              }
                            >
                              <span class="latin">{fmt.num(cd().d)}</span> 天
                            </Show>
                          </b>
                          <Scale p={fmt.progress(createdAt, openAt, props.now)} />
                        </div>
                      }
                    >
                      <div class="ledger__when">
                        <span class="ledger__k">已启封</span>
                        <b>{fmt.date(openAt)}</b>
                        <small>在途 {fmt.span(openAt - createdAt)}</small>
                      </div>
                    </Show>
                    <div class="ledger__fav" title={`被收藏 ${c.favoriteCount} 次`}>
                      <Icon name="heart" />
                      <span class="latin">{fmt.num(c.favoriteCount)}</span>
                    </div>
                    <div class="ledger__act">
                      <a class="btn btn--text" href={`/capsules/${c.code}`}>
                        查看
                      </a>
                      <button
                        class="btn btn--text btn--danger"
                        type="button"
                        data-testid="delete-capsule"
                        onClick={() =>
                          void l.remove(c, () => (
                            <div class="dlg__mark">
                              <Seal ch="删" variant="line" />
                            </div>
                          ))
                        }
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              }}
            </For>
          </ul>
          <ListMore show={l.hasMore()} busy={l.moreBusy()} left={l.total() - items().length} onMore={() => void l.loadMore()} />
          <p class="me__fine">
            <Icon name="info" />
            胶囊的内容与启封时刻一经封存就不可修改；你可以随时删除自己写的胶囊，无论它是否已经启封。
          </p>
        </Show>
      )}
    </Show>
  );
}

function Favorites(props: { list: MyList; now: number }) {
  const l = props.list;
  return (
    <Show when={l.items()}>
      {(items) => (
        <Show
          when={items().length}
          fallback={
            <div class="empty empty--inline" data-testid="list-empty">
              <Seal ch="藏" variant="line" />
              <h3>还没有收藏</h3>
              <p>去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。</p>
              <a class="btn btn--primary" href="/">
                去广场逛逛
                <Icon name="arrow" class="ic--go" />
              </a>
            </div>
          }
        >
          <div class="me__bar">
            <span>按收藏时间倒序 · 共 {l.total()} 枚</span>
            <a class="btn btn--ghost btn--sm" href="/">
              去广场逛逛
            </a>
          </div>
          <div class="grid grid--me">
            <For each={items()}>
              {(c, i) => (
                <PaperCard
                  c={c}
                  i={i()}
                  now={props.now}
                  mine={auth.user?.nickname === c.creator.nickname}
                  testId="fav-item"
                  openTestId="row-open"
                  onFavChange={(fav) => l.onFavChange(c.id, fav)}
                />
              )}
            </For>
          </div>
          <ListMore show={l.hasMore()} busy={l.moreBusy()} left={l.total() - items().length} onMore={() => void l.loadMore()} />
        </Show>
      )}
    </Show>
  );
}

function Profile(props: { p: ProfileForm; ids: string[]; onSaved: () => void }) {
  const p = props.p;
  return (
    <div class="profile">
      <section class="pane">
        <h2 class="pane__h">基本信息</h2>
        <form
          novalidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.saveProfile().then(props.onSaved);
          }}
        >
          <Field
            id="p-email"
            label="邮箱"
            type="email"
            value={p.user().email}
            disabled
            hint="邮箱是登录账号，不可修改。"
            trail={
              <span class="field__state is-lock" aria-hidden="true">
                <Icon name="lock" />
              </span>
            }
          />
          <Field
            id="p-nick"
            label="昵称"
            autoComplete="nickname"
            hint={p.nick().hint ?? "2–20 个字符，全站唯一。"}
            value={p.nickname()}
            onChange={p.setNickname}
            error={p.errors().nickname}
            testId="profile-nickname"
            trail={<NickState state={p.nickChanged() ? p.nick().state : ""} />}
          />
          <div class="field field--plain">
            <span class="field__label">邮票头像</span>
            <AvatarPicker ids={props.ids} value={p.avatarId()} onChange={p.setAvatarId} />
          </div>
          <FormMsg m={p.msg()} />
          <div class="pane__act">
            <button class="btn btn--ghost" type="button" onClick={() => p.resetProfile()}>
              重置
            </button>
            <button class={`btn btn--primary${p.busy() ? " is-busy" : ""}`} type="submit" disabled={p.busy()} data-testid="profile-save">
              <span>{p.busy() ? "保存中…" : "保存更改"}</span>
            </button>
          </div>
        </form>
      </section>

      <section class="pane">
        <h2 class="pane__h">修改密码</h2>
        <form
          novalidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.changePassword();
          }}
        >
          <PasswordField id="pw-cur" label="当前密码" autoComplete="current-password" value={p.pwd().current} onChange={(v) => p.setPwd("current", v)} error={p.errors().current} errorKey="current" testId="pwd-current" />
          <PasswordField id="pw-new" label="新密码" autoComplete="new-password" value={p.pwd().next} onChange={(v) => p.setPwd("next", v)} error={p.errors().next} errorKey="new" testId="pwd-new" />
          <PwdRules value={p.pwd().next} />
          <PasswordField id="pw-again" label="再输一次新密码" autoComplete="new-password" value={p.pwd().confirm} onChange={(v) => p.setPwd("confirm", v)} error={p.errors().confirm} errorKey="confirm" testId="pwd-confirm" />
          <FormMsg m={p.pwdMsg()} />
          <p class="pane__fine">
            <Icon name="info" />
            修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。
          </p>
          <div class="pane__act">
            <button class={`btn btn--primary${p.pwdBusy() ? " is-busy" : ""}`} type="submit" disabled={p.pwdBusy()} data-testid="pwd-submit">
              <span>{p.pwdBusy() ? "更新中…" : "更新密码"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const STATS = [
  ["created", "写下的胶囊"],
  ["unopened", "还在等待启封"],
  ["favoritesReceived", "被收藏的次数"],
] as const;

export function PaperMePage(props: { tab: MeTab; stats: MyStatsState; body: MeBody }) {
  const user = () => auth.user!;
  const navigate = useNavigate();
  const now = useNow();
  const stats = props.stats.stats;
  let nav: HTMLElement | undefined;
  // 页签下的墨线：跟着当前页签滑过去
  const ink = createSlider(() => nav, ".tabs__it.is-active", () => [props.tab, stats()]);

  const It = (q: { k: MeTab; label: string; n?: number }): JSX.Element => (
    <a
      class={`tabs__it${props.tab === q.k ? " is-active" : ""}`}
      href={`/me/${q.k}`}
      aria-current={props.tab === q.k ? "page" : undefined}
      data-testid={`me-tab-${q.k}`}
      data-count={q.n}
    >
      {q.label}
      <Show when={q.n != null}>
        <sup>{q.n}</sup>
      </Show>
    </a>
  );

  return (
    <div class="page page--me">
      <div class="wrap me">
        <header class="me__head">
          <div class="me__id">
            <AvatarStamp id={user().avatarId} class="stamp--lg" />
            <div>
              <div class="overline">
                <i />
                My desk
              </div>
              <h1 class="h1">{user().nickname}</h1>
              <p class="me__mail">
                <span class="mono">{user().email}</span>
                <span>{fmt.cn(ms(user().createdAt))} 加入</span>
              </p>
            </div>
          </div>
          <dl class="me__stats">
            <For each={STATS}>
              {([k, label]) => (
                <div data-testid="me-stat" data-key={k} data-value={stats()?.[k] ?? ""}>
                  <dd class="latin">{stats() ? fmt.num(stats()![k]) : "—"}</dd>
                  <dt>{label}</dt>
                </div>
              )}
            </For>
          </dl>
        </header>

        <nav class="tabs" ref={nav} aria-label="我的">
          <It k="created" label="我创建的" n={stats()?.created} />
          <It k="favorites" label="我收藏的" n={stats()?.favoritesGiven} />
          <It k="profile" label="账号设置" />
          <span class="tabs__ink" aria-hidden="true" style={ink()} />
          <button
            class="linkbtn tabs__out"
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

        {/* keyed：换页签时整块重建，is-swap 的入场动画随之重播 */}
        <Show when={props.body} keyed>
          {(b) => (
            <div class="me__body is-swap" data-tab={b.tab}>
              <Switch>
                <Match when={b.tab === "created" && b.list}>{(list) => <Created list={list()} now={now()} />}</Match>
                <Match when={b.tab === "favorites" && b.list}>{(list) => <Favorites list={list()} now={now()} />}</Match>
                <Match when={b.profile}>{(p) => <Profile p={p()} ids={b.avatarIds?.() ?? []} onSaved={props.stats.refresh} />}</Match>
              </Switch>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
