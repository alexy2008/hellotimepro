import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// 不在全局开启 runes：Svelte 5 会按文件自动检测——
// 我们的 .svelte 文件全部使用 $state / $props / $derived / $effect，
// 编译器会自动识别为 runes 模式；而第三方库（如 svelte-routing）的
// 旧式 .svelte 文件仍能以 legacy 模式编译。
export default {
  preprocess: vitePreprocess(),
};
