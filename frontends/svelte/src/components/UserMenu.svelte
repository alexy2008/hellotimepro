<!-- 已登录时页头右侧的头像菜单。createdIcon：两套皮肤给「我创建的」配的图标不同 -->
<script lang="ts">
  import { navigate, useLocation } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { toast } from "@/stores/feedback.svelte.ts";
  import type { IconName } from "@/lib/icons";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";

  let { createdIcon }: { createdIcon: IconName } = $props();
  const location = useLocation();
  let open = $state(false);
  let box = $state<HTMLElement>();

  // 换页就收起
  $effect(() => {
    void $location.pathname;
    open = false;
  });

  // 展开时：点外面、按 Esc 收起
  $effect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box?.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") open = false;
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  });

  async function logout() {
    open = false;
    await authStore.logout(true);
    toast("已登出");
    navigate("/");
  }
</script>

{#if authStore.user}
  {@const u = authStore.user}
  <div bind:this={box} class={["umenu", open && "is-open"]}>
    <button
      class="uchip"
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`${u.nickname} 的菜单`}
      data-testid="user-menu"
      data-nickname={u.nickname}
      onclick={() => (open = !open)}
    >
      <AppAvatar id={u.avatarId} />
      <span class="uchip__n">{u.nickname}</span>
      <AppIcon name="chev-down" class="ic--chev" />
    </button>
    <div class="umenu__pop" role="menu">
      <div class="umenu__who">
        <AppAvatar id={u.avatarId} class="av--lg" />
        <div>
          <b>{u.nickname}</b>
          <span class="mono">{u.email}</span>
        </div>
      </div>
      <a role="menuitem" href="/me/created" data-testid="menu-created"><AppIcon name={createdIcon} />我创建的</a>
      <a role="menuitem" href="/me/favorites" data-testid="menu-favorites"><AppIcon name="heart" />我收藏的</a>
      <a role="menuitem" href="/me/profile" data-testid="menu-profile"><AppIcon name="sliders" />账号设置</a>
      <hr />
      <button role="menuitem" type="button" data-testid="logout" onclick={logout}><AppIcon name="logout" />登出</button>
    </div>
  </div>
{/if}
