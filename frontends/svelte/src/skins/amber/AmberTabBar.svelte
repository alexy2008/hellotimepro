<!-- 「琥珀」手机底栏（桌面宽度下由样式隐藏） -->
<script lang="ts">
  import { useLocation } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { navAttrs, navKey } from "@/lib/nav";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import CreateLink from "@/components/CreateLink.svelte";

  const location = useLocation();
  const cur = $derived(navKey($location.pathname));
</script>

<nav class="tabbar" aria-label="主导航">
  <a href="/" data-testid="tab-plaza" {...navAttrs("plaza", cur)}><AppIcon name="grid" /><span>广场</span></a>
  <a href="/open" data-testid="tab-open" {...navAttrs("open", cur)}><AppIcon name="key" /><span>开启</span></a>
  <CreateLink data-testid="tab-create" {...navAttrs("create", cur, "tabbar__main")}>
    <i><AppIcon name="pen" /></i>
    <span>写一枚</span>
  </CreateLink>
  <a href={authStore.user ? "/me/created" : "/login"} data-testid="tab-me" {...navAttrs("me", cur)}>
    {#if authStore.user}<AppAvatar id={authStore.user.avatarId} />{:else}<AppIcon name="user" />{/if}
    <span>{authStore.user ? "我的" : "登录"}</span>
  </a>
</nav>
