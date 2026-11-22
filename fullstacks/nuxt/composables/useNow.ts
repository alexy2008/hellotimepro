import { onMounted, onScopeDispose, readonly } from "vue";

// SSR 时钟由 Nuxt 随 payload 传递。浏览器挂载后，同一页的倒数共用整秒节拍。
let users = 0;
let timer: ReturnType<typeof setTimeout>;

export function useNow() {
  const now = useState("clock", Date.now);
  let active = false;

  function tick() {
    now.value = Date.now();
    timer = setTimeout(tick, 1000 - (now.value % 1000) + 4);
  }

  onMounted(() => {
    active = true;
    if (++users === 1) tick();
  });
  onScopeDispose(() => {
    if (active && --users === 0) clearTimeout(timer);
  });

  return readonly(now);
}
