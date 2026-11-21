<!-- ============================================================
     「琥珀」我的（/me/created · /me/favorites · /me/profile）
     页签是一枚大号分段控件，每一项是链接，滑块跟着当前页签
     结构与类名照 2.0 原型 amber/view-account.js
     ============================================================ -->
<script lang="ts">
  import { navigate } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { clock } from "@/stores/clock.svelte.ts";
  import { toast } from "@/stores/feedback.svelte.ts";
  import { useMe } from "@/state/account.svelte.ts";
  import { fmt, ms } from "@/lib/fmt";
  import { slider } from "@/lib/attach";
  import type { IconName } from "@/lib/icons";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import AmberMeCreated from "./AmberMeCreated.svelte";
  import AmberMeFavorites from "./AmberMeFavorites.svelte";
  import AmberMeProfile from "./AmberMeProfile.svelte";

  const me = useMe();
  const user = $derived(authStore.user!);
  const stats = $derived(me.stats.stats);

  const STATS = [
    ["created", "写下的胶囊"],
    ["unopened", "还在封存中"],
    ["favoritesReceived", "被收藏的次数"],
  ] as const;
  const tabs = $derived<Array<{ key: string; icon: IconName; label: string; n?: number }>>([
    { key: "created", icon: "feather", label: "我创建的", n: stats?.created },
    { key: "favorites", icon: "heart", label: "我收藏的", n: stats?.favoritesGiven },
    { key: "profile", icon: "sliders", label: "账号设置" },
  ]);

  async function logout() {
    await authStore.logout(true);
    toast("已登出");
    navigate("/");
  }
</script>

<div class="page page--me">
  <div class="container me">
    <header class="me__head card">
      <div class="me__id">
        <div class="me__orb">
          <AppAvatar id={user.avatarId} class="av--hero" />
          <span class="me__ring"></span>
        </div>
        <div>
          <div class="eyebrow">My capsules</div>
          <h1 class="page-title">{user.nickname}</h1>
          <p class="me__mail">
            <span class="mono">{user.email}</span>
            <span>{fmt.cn(ms(user.createdAt))} 加入</span>
          </p>
        </div>
      </div>
      <dl class="me__stats">
        {#each STATS as [k, label] (k)}
          <div data-testid="me-stat" data-key={k} data-value={stats?.[k] ?? ""}>
            <dd class="mono">{stats ? fmt.num(stats[k]) : "—"}</dd>
            <dt>{label}</dt>
          </div>
        {/each}
      </dl>
    </header>

    <div class="me__bar">
      <nav class="seg seg--lg" aria-label="我的" {@attach slider(".seg__opt.is-active", ".seg__thumb", () => [me.tab, stats?.created, stats?.favoritesGiven])}>
        <span class="seg__thumb"></span>
        {#each tabs as t (t.key)}
          <a
            class={["seg__opt", me.tab === t.key && "is-active"]}
            href={`/me/${t.key}`}
            aria-current={me.tab === t.key ? "page" : undefined}
            data-testid={`me-tab-${t.key}`}
            data-count={t.n}
          >
            <AppIcon name={t.icon} />{t.label}{#if t.n != null}<sup>{t.n}</sup>{/if}
          </a>
        {/each}
      </nav>
      <button class="btn btn--ghost btn--sm" type="button" onclick={logout}><AppIcon name="logout" />登出</button>
    </div>

    {#key me.tab}
      <div class="me__body is-swap" data-tab={me.tab}>
        {#if me.tab === "created"}
          <AmberMeCreated now={clock.now} list={me.created} />
        {:else if me.tab === "favorites"}
          <AmberMeFavorites now={clock.now} list={me.favorites} />
        {:else}
          <AmberMeProfile />
        {/if}
      </div>
    {/key}
  </div>
</div>
