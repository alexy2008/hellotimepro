<!-- ============================================================
     「时笺」我的（/me/created · /me/favorites · /me/profile）
     三个页签共用这一个视图（同一条路由、参数不同），切页签时页头与统计不重新挂载
     结构与类名照 2.0 原型 paper/view-account.js
     ============================================================ -->
<script lang="ts">
  import { navigate } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { clock } from "@/stores/clock.svelte.ts";
  import { toast } from "@/stores/feedback.svelte.ts";
  import { useMe } from "@/state/account.svelte.ts";
  import { fmt, ms } from "@/lib/fmt";
  import { slider } from "@/lib/attach";
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperAvatarStamp from "./PaperAvatarStamp.svelte";
  import PaperMeCreated from "./PaperMeCreated.svelte";
  import PaperMeFavorites from "./PaperMeFavorites.svelte";
  import PaperMeProfile from "./PaperMeProfile.svelte";

  const me = useMe();
  const user = $derived(authStore.user!);
  const stats = $derived(me.stats.stats);

  const STATS = [
    ["created", "写下的胶囊"],
    ["unopened", "还在等待启封"],
    ["favoritesReceived", "被收藏的次数"],
  ] as const;
  const tabs = $derived([
    { key: "created", label: "我创建的", n: stats?.created },
    { key: "favorites", label: "我收藏的", n: stats?.favoritesGiven },
    { key: "profile", label: "账号设置", n: undefined },
  ]);

  async function logout() {
    await authStore.logout(true);
    toast("已登出");
    navigate("/");
  }
</script>

<div class="page page--me">
  <div class="wrap me">
    <header class="me__head">
      <div class="me__id">
        <PaperAvatarStamp id={user.avatarId} class="stamp--lg" />
        <div>
          <div class="overline"><i></i>My desk</div>
          <h1 class="h1">{user.nickname}</h1>
          <p class="me__mail">
            <span class="mono">{user.email}</span>
            <span>{fmt.cn(ms(user.createdAt))} 加入</span>
          </p>
        </div>
      </div>
      <dl class="me__stats">
        {#each STATS as [k, label] (k)}
          <div data-testid="me-stat" data-key={k} data-value={stats?.[k] ?? ""}>
            <dd class="latin">{stats ? fmt.num(stats[k]) : "—"}</dd>
            <dt>{label}</dt>
          </div>
        {/each}
      </dl>
    </header>

    <!-- 页签下的墨线：跟着当前页签滑过去 -->
    <nav class="tabs" aria-label="我的" {@attach slider(".tabs__it.is-active", ".tabs__ink", () => [me.tab, stats])}>
      {#each tabs as t (t.key)}
        <a
          class={["tabs__it", me.tab === t.key && "is-active"]}
          href={`/me/${t.key}`}
          aria-current={me.tab === t.key ? "page" : undefined}
          data-testid={`me-tab-${t.key}`}
          data-count={t.n}
        >
          {t.label}{#if t.n != null}<sup>{t.n}</sup>{/if}
        </a>
      {/each}
      <span class="tabs__ink" aria-hidden="true"></span>
      <button class="linkbtn tabs__out" type="button" onclick={logout}><AppIcon name="logout" />登出</button>
    </nav>

    {#key me.tab}
      <div class="me__body is-swap" data-tab={me.tab}>
        {#if me.tab === "created"}
          <PaperMeCreated now={clock.now} list={me.created} />
        {:else if me.tab === "favorites"}
          <PaperMeFavorites now={clock.now} list={me.favorites} />
        {:else}
          <PaperMeProfile />
        {/if}
      </div>
    {/key}
  </div>
</div>
