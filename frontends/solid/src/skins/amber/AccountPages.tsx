// ============================================================
// 「琥珀」登录（/login）· 注册（/register）· 我的（/me/created · /me/favorites · /me/profile）
// 结构与类名照 2.0 原型 amber/view-account.js
// 表单状态都由路由页创建后传进来（f / body），这里只负责画出来
// ============================================================

import { For, Match, Show, Switch, type Accessor, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { fmt, ms } from "@/lib/fmt";
import { Icon, type IconName } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { auth, logout } from "@/stores/auth";
import { copyText, toast } from "@/stores/feedback";
import { useNow } from "@/primitives/now";
import type { LoginForm, MyList, MyStatsState, ProfileForm, RegisterForm } from "@/primitives/account";
import { AvatarPicker, Field, NickState, PasswordField, PwdRules } from "@/components/forms";
import { Avatar, FormMsg, ListMore, MyListStatus } from "@/components/shared";
import { CreateLink } from "@/components/LoginPrompt";
import { createSlider } from "@/components/Seg";
import type { MeBody, MeTab } from "@/pages/MePage";
import { Badge, CapsuleArt, VisBadge, cdShort } from "./parts";
import { AmberCard } from "./Card";

/** 登录 / 注册卡片顶上的小景：一枚在轨道上缓缓转动的胶囊 */
const AuthArt = (props: { state: "locked" | "opened" }) => (
  <div class="auth__art" aria-hidden="true">
    <span class="auth__orbit" />
    <span class="auth__orbit auth__orbit--2" />
    <CapsuleArt code={null} state={props.state} width={180} />
  </div>
);

const withRedirect = (path: string, redirect: string | null) => (redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path);

export function AmberLoginPage(props: { f: LoginForm }) {
  const f = props.f;
  return (
    <div class="page page--auth">
      <div class="container auth">
        <div class="auth__card card">
          <AuthArt state="locked" />
          <div class="eyebrow eyebrow--center">Welcome back</div>
          <h1 class="page-title">欢迎回来</h1>
          <p class="page-lead">你封存的胶囊，还在等你回来开启。</p>
          <Show when={f.redirect()}>
            <p class="tip">
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
            <Field id="email" label="邮箱" type="email" lead="mail" autoComplete="email" placeholder="you@example.com" value={f.email()} onChange={f.setEmail} error={f.errors().email} testId="login-email" autoFocus />
            <PasswordField
              id="password"
              label="密码"
              lead="lock"
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
              <Icon name="arrow" />
            </button>
          </form>
          <p class="auth__alt">
            还没有账号？
            <a href={withRedirect("/register", f.redirect())} data-testid="to-register">
              注册一个
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export function AmberRegisterPage(props: { f: RegisterForm; ids: Accessor<string[]> }) {
  const f = props.f;
  return (
    <div class="page page--auth">
      <div class="container auth">
        <div class="auth__card auth__card--wide card">
          <AuthArt state="opened" />
          <div class="eyebrow eyebrow--center">Create account</div>
          <h1 class="page-title">领一个身份</h1>
          <p class="page-lead">挑一颗星球当头像，然后写下你的第一枚胶囊。</p>
          <form
            novalidate
            onSubmit={(e) => {
              e.preventDefault();
              void f.submit();
            }}
          >
            <div class="form__row">
              <Field id="email" label="邮箱" type="email" lead="mail" req autoComplete="email" placeholder="you@example.com" hint="作为登录账号，注册后不可修改。" value={f.email()} onChange={f.setEmail} error={f.errors().email} testId="register-email" autoFocus />
              <Field
                id="nickname"
                label="昵称"
                lead="user"
                req
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
            <PasswordField id="password" label="密码" lead="lock" req autoComplete="new-password" placeholder="设置密码" value={f.password()} onChange={f.setPassword} error={f.errors().password} testId="register-password" />
            <PwdRules value={f.password()} />
            <div class="field field--plain">
              <div class="field__head">
                <span class="field__label">
                  头像 <em>*</em>
                </span>
                <span class="field__count">十选一，不支持上传</span>
              </div>
              <AvatarPicker ids={props.ids()} value={f.avatarId()} onChange={f.setAvatarId} />
            </div>
            <div class="form__err" role="alert">
              {f.errors().form ?? f.errors().avatarId}
            </div>
            <button class={`btn btn--primary btn--lg btn--block${f.busy() ? " is-busy" : ""}`} type="submit" disabled={f.busy()} data-testid="register-submit">
              <span>{f.busy() ? "正在创建…" : "创建账号，开始写胶囊"}</span>
              <Icon name="arrow" />
            </button>
          </form>
          <p class="auth__alt">
            已经有账号？
            <a href={withRedirect("/login", f.redirect())} data-testid="to-login">
              去登录
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 我的 ---------------- */

function Empty(props: { state: "locked" | "opened"; title: string; text: string; children: JSX.Element }) {
  return (
    <div class="empty" data-testid="list-empty">
      <CapsuleArt code={null} state={props.state} width={170} class="empty__art" />
      <h3 class="empty__title">{props.title}</h3>
      <p>{props.text}</p>
      {props.children}
    </div>
  );
}

function Created(props: { list: MyList; now: number }) {
  const l = props.list;
  return (
    <Show when={l.readyItems()} fallback={<MyListStatus error={l.error()} onRetry={() => void l.reload()} />}>
      {(items) => (
        <Show
          when={items().length}
          fallback={
            <Empty state="opened" title="还没有写下任何胶囊" text="第一枚，写给一年后的自己怎么样？">
              <CreateLink class="btn btn--primary">
                <Icon name="pen" />
                写一枚胶囊
              </CreateLink>
            </Empty>
          }
        >
          <div class="me__sub">
            <span>按创建时间倒序 · 共 {l.total()} 枚</span>
            <CreateLink class="btn btn--primary btn--sm">
              <Icon name="plus" />
              写一枚
            </CreateLink>
          </div>
          <ul class="ledger">
            <For each={items()}>
              {(c, i) => {
                const openAt = ms(c.openAt),
                  createdAt = ms(c.createdAt);
                const opened = () => c.isOpened || openAt <= props.now;
                return (
                  <li
                    class="ledger__row"
                    style={{ "--i": i(), "--glow": paletteOf(c.code).glow }}
                    data-testid="my-capsule"
                    data-code={c.code}
                    data-state={opened() ? "opened" : "sealed"}
                    data-in-plaza={String(c.inPlaza)}
                  >
                    <a class="ledger__art" href={`/capsules/${c.code}`} tabIndex={-1} aria-hidden="true">
                      <CapsuleArt code={c.code} state={opened() ? "opened" : "locked"} width={112} />
                    </a>
                    <div class="ledger__main">
                      <a class="ledger__title" href={`/capsules/${c.code}`} data-testid="row-open">
                        {c.title}
                      </a>
                      <div class="ledger__sub">
                        <button class="ledger__code mono" type="button" title="点击复制胶囊码" onClick={() => void copyText(c.code, `已复制胶囊码 ${c.code}`)}>
                          {c.code}
                          <Icon name="copy" />
                        </button>
                        <VisBadge inPlaza={c.inPlaza} />
                        <span>封存于 {fmt.date(createdAt)}</span>
                      </div>
                    </div>
                    <div class="ledger__when">
                      <Show
                        when={opened()}
                        fallback={
                          <>
                            <span class="ledger__cd">
                              <Icon name="hourglass" />
                              <b class="mono">{cdShort(openAt, props.now)}</b>
                            </span>
                            <div class="pc__progress">
                              <span style={{ width: `${Math.max(2, fmt.progress(createdAt, openAt, props.now))}%` }} />
                            </div>
                          </>
                        }
                      >
                        <Badge kind="opened" icon="mail">
                          已开启
                        </Badge>
                        <span>
                          {fmt.date(openAt)} · 沉睡 {fmt.span(openAt - createdAt)}
                        </span>
                      </Show>
                    </div>
                    <div class="ledger__fav" title={`被收藏 ${c.favoriteCount} 次`}>
                      <Icon name="heart" />
                      <span class="mono">{fmt.num(c.favoriteCount)}</span>
                    </div>
                    <div class="ledger__act">
                      <a class="btn btn--ghost btn--sm" href={`/capsules/${c.code}`}>
                        查看
                      </a>
                      <button
                        class="btn btn--danger-ghost btn--sm"
                        type="button"
                        data-testid="delete-capsule"
                        onClick={() =>
                          void l.remove(c, () => (
                            <div class="dlg__art">
                              <CapsuleArt code={c.code} state="opened" width={120} />
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
          <p class="tip tip--quiet">
            <Icon name="info" />
            <span>胶囊的内容与开启时间封存后不可修改；你可以随时删除自己写的胶囊，无论它是否已经开启。</span>
          </p>
        </Show>
      )}
    </Show>
  );
}

function Favorites(props: { list: MyList; now: number }) {
  const l = props.list;
  return (
    <Show when={l.readyItems()} fallback={<MyListStatus error={l.error()} onRetry={() => void l.reload()} />}>
      {(items) => (
        <Show
          when={items().length}
          fallback={
            <Empty state="locked" title="还没有收藏" text="去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。">
              <a class="btn btn--primary" href="/">
                去广场逛逛
                <Icon name="arrow" />
              </a>
            </Empty>
          }
        >
          <div class="me__sub">
            <span>按收藏时间倒序 · 共 {l.total()} 枚</span>
            <a class="btn btn--ghost btn--sm" href="/">
              去广场逛逛
            </a>
          </div>
          <div class="grid">
            <For each={items()}>
              {(c, i) => (
                <AmberCard
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
      <section class="card card--pad">
        <div class="eyebrow">Profile</div>
        <h2 class="card__title">基本信息</h2>
        <form
          novalidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.saveProfile().then(props.onSaved);
          }}
        >
          <Field id="p-email" label="邮箱" type="email" lead="mail" value={p.user().email} disabled hint="邮箱是登录账号，不可修改。" />
          <Field
            id="p-nick"
            label="昵称"
            lead="user"
            autoComplete="nickname"
            hint={p.nick().hint ?? "2–20 个字符，全站唯一。"}
            value={p.nickname()}
            onChange={p.setNickname}
            error={p.errors().nickname}
            testId="profile-nickname"
            trail={<NickState state={p.nickChanged() ? p.nick().state : ""} />}
          />
          <div class="field field--plain">
            <div class="field__head">
              <span class="field__label">头像</span>
            </div>
            <AvatarPicker ids={props.ids} value={p.avatarId()} onChange={p.setAvatarId} />
          </div>
          <FormMsg m={p.msg()} />
          <div class="card__act">
            <button class="btn btn--ghost" type="button" onClick={() => p.resetProfile()}>
              重置
            </button>
            <button class={`btn btn--primary${p.busy() ? " is-busy" : ""}`} type="submit" disabled={p.busy()} data-testid="profile-save">
              <span>{p.busy() ? "保存中…" : "保存更改"}</span>
            </button>
          </div>
        </form>
      </section>
      <section class="card card--pad">
        <div class="eyebrow">Security</div>
        <h2 class="card__title">修改密码</h2>
        <form
          novalidate
          onSubmit={(e) => {
            e.preventDefault();
            void p.changePassword();
          }}
        >
          <PasswordField id="pw-cur" label="当前密码" lead="lock" autoComplete="current-password" value={p.pwd().current} onChange={(v) => p.setPwd("current", v)} error={p.errors().current} errorKey="current" testId="pwd-current" />
          <PasswordField id="pw-new" label="新密码" lead="key" autoComplete="new-password" value={p.pwd().next} onChange={(v) => p.setPwd("next", v)} error={p.errors().next} errorKey="new" testId="pwd-new" />
          <PwdRules value={p.pwd().next} />
          <PasswordField id="pw-again" label="再输一次新密码" lead="key" autoComplete="new-password" value={p.pwd().confirm} onChange={(v) => p.setPwd("confirm", v)} error={p.errors().confirm} errorKey="confirm" testId="pwd-confirm" />
          <FormMsg m={p.pwdMsg()} />
          <p class="tip tip--quiet">
            <Icon name="shield" />
            <span>修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。</span>
          </p>
          <div class="card__act">
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
  ["unopened", "还在封存中"],
  ["favoritesReceived", "被收藏的次数"],
] as const;

export function AmberMePage(props: { tab: MeTab; stats: MyStatsState; body: MeBody }) {
  const user = () => auth.user!;
  const navigate = useNavigate();
  const now = useNow();
  const stats = props.stats.stats;

  return (
    <div class="page page--me">
      <div class="container me">
        <header class="me__head card">
          <div class="me__id">
            <div class="me__orb">
              <Avatar id={user().avatarId} class="av--hero" />
              <span class="me__ring" />
            </div>
            <div>
              <div class="eyebrow">My capsules</div>
              <h1 class="page-title">{user().nickname}</h1>
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
                  <dd class="mono">{stats() ? fmt.num(stats()![k]) : "—"}</dd>
                  <dt>{label}</dt>
                </div>
              )}
            </For>
          </dl>
        </header>

        <div class="me__bar">
          <MeTabs tab={props.tab} created={stats()?.created} favorites={stats()?.favoritesGiven} />
          <button
            class="btn btn--ghost btn--sm"
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

/** 「我的」页签：一枚大号分段控件，每一项是链接，滑块跟着当前页签 */
function MeTabs(props: { tab: MeTab; created?: number; favorites?: number }) {
  let box: HTMLElement | undefined;
  const thumb = createSlider(() => box, ".seg__opt.is-active", () => [props.tab, props.created, props.favorites]);
  const It = (q: { k: MeTab; icon: IconName; label: string; n?: number }) => (
    <a
      class={`seg__opt${props.tab === q.k ? " is-active" : ""}`}
      href={`/me/${q.k}`}
      aria-current={props.tab === q.k ? "page" : undefined}
      data-testid={`me-tab-${q.k}`}
      data-count={q.n}
    >
      <Icon name={q.icon} />
      {q.label}
      <Show when={q.n != null}>
        <sup>{q.n}</sup>
      </Show>
    </a>
  );
  return (
    <nav class="seg seg--lg" ref={box} aria-label="我的">
      <span class="seg__thumb" style={thumb()} />
      <It k="created" icon="feather" label="我创建的" n={props.created} />
      <It k="favorites" icon="heart" label="我收藏的" n={props.favorites} />
      <It k="profile" icon="sliders" label="账号设置" />
    </nav>
  );
}
