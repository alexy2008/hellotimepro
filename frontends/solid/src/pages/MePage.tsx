import { Show, createMemo, untrack, type Accessor } from "solid-js";
import { Navigate, useParams } from "@solidjs/router";
import { auth } from "@/stores/auth";
import { createAvatarIds, createMyList, createMyStats, createProfile, type MyList, type ProfileForm } from "@/primitives/account";
import { PaperMePage } from "@/skins/paper/AccountPages";
import { AmberMePage } from "@/skins/amber/AccountPages";
import { Skinned } from "./Skinned";

const TABS = ["created", "favorites", "profile"] as const;
export type MeTab = (typeof TABS)[number];

/** 当前页签的状态：列表（我创建的 / 我收藏的）或资料与密码表单 */
export interface MeBody {
  tab: MeTab;
  list?: MyList;
  profile?: ProfileForm;
  avatarIds?: Accessor<string[]>;
}

/** 「我的」：三个页签共用一个页面组件，切页签时页头与统计不重绘 */
export function MePage() {
  document.title = "我的 · HelloTime Pro";
  const params = useParams();
  const tab = () => params.tab as MeTab;
  return (
    <Show when={TABS.includes(tab())} fallback={<Navigate href="/me/created" />}>
      {/* 只有 refresh token、user 还在路上（刷新页）时先等一下 */}
      <Show when={auth.user}>
        <MeView tab={tab()} />
      </Show>
    </Show>
  );
}

function MeView(props: { tab: MeTab }) {
  const stats = createMyStats();
  // 每个页签自己的状态建在这个 memo 里：换页签时旧的随之销毁（等于离开就清空），
  // 换皮肤时它不动，列表、填了一半的资料与密码都还在。untrack：建状态时的读取不算 memo 的依赖
  const body = createMemo<MeBody>(() => {
    const tab = props.tab;
    return untrack(() =>
      tab === "profile"
        ? { tab, profile: createProfile(), avatarIds: createAvatarIds() }
        : { tab, list: createMyList(tab, stats.refresh) },
    );
  });
  return (
    <Skinned
      paper={<PaperMePage tab={props.tab} stats={stats} body={body()} />}
      amber={<AmberMePage tab={props.tab} stats={stats} body={body()} />}
    />
  );
}
