"use client";

import { FavoriteProjectionContext } from "@/components/FavButton";
import { useParams } from "@/lib/router";
import { useUi } from "@/stores/ui";
import { useCapsuleByCode } from "@/hooks/useCapsule";
import { PaperCapsulePage } from "@/skins/paper/CapsulePages";
import { AmberCapsulePage } from "@/skins/amber/CapsulePages";
import type { CapsuleSeed } from "@/types";

/**
 * 胶囊详情 /capsules/:code：逻辑共用（hooks/useCapsule），视图按皮肤各一份。
 * initial 是服务端（app/capsules/[code]/page.tsx）以匿名身份取好的第一屏。
 */
export function CapsuleByCodePage({ initial }: { initial: CapsuleSeed | null }) {
  const { code = "" } = useParams<{ code?: string }>();
  return <CapsuleRoute key={code} code={code} initial={initial?.code === code ? initial : null} />;
}

function CapsuleRoute({ code, initial }: { code: string; initial: CapsuleSeed | null }) {
  const skin = useUi((s) => s.skin);
  const cap = useCapsuleByCode(code, initial);
  return (
    <FavoriteProjectionContext.Provider value={{
      ready: cap.favoriteReady,
      failed: cap.favoriteFailed,
      retry: cap.retryFavorite,
      onChange: cap.patchFavorite,
    }}>
      {skin === "paper" ? <PaperCapsulePage code={code} cap={cap} /> : <AmberCapsulePage code={code} cap={cap} />}
    </FavoriteProjectionContext.Provider>
  );
}
