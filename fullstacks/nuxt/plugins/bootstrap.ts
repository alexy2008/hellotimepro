export default defineNuxtPlugin({
  name: "hellotime-bootstrap",
  dependsOn: ["pinia"],
  setup(nuxt) {
    const ui = useUiStore(usePinia());
    if (import.meta.server) {
      ui.restore();
      return;
    }

    const auth = useAuthStore(usePinia());
    wireAuthApi(auth);
    const preferences = { ...document.documentElement.dataset };
    if (nuxt.payload.serverRendered) {
      // 公开页的 HTML 以匿名身份生成，先复用 SSR DOM，再更新个人投影。
      nuxt.hooks.hookOnce("app:suspense:resolve", () => {
        ui.restore(preferences);
        auth.hydrate();
      });
    } else {
      ui.restore(preferences);
      auth.hydrate();
    }
  },
});
