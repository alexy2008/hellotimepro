import { Show, type JSX } from "solid-js";
import { skin } from "@/stores/ui";

/**
 * 按当前皮肤挑视图。两个 prop 都是 JSX：Solid 把它们编译成 getter，
 * <Show> 只在需要时才读，所以同一时刻只会创建当前皮肤那一份视图；
 * 换皮肤时旧视图销毁、新视图创建，而外面路由页里建好的状态原样保留。
 */
export function Skinned(props: { paper: JSX.Element; amber: JSX.Element }) {
  return (
    <Show when={skin() === "paper"} fallback={props.amber}>
      {props.paper}
    </Show>
  );
}
