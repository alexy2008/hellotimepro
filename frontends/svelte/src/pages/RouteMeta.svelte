<!-- 路由变化时：body[data-route]（个别皮肤样式按页面微调）与页面标题 -->
<script lang="ts">
  import { useLocation } from "svelte-routing";
  import { routeName, routeTitle } from "@/lib/nav";

  const location = useLocation();

  $effect(() => {
    const path: string = $location.pathname;
    document.body.dataset.route = routeName(path);
    const title = routeTitle(path);
    if (title) document.title = title;
  });
</script>
