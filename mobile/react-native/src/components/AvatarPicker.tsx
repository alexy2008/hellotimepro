// 头像选择：移植自 frontends/react-ts/src/components/AvatarPicker.tsx。
// 横向滚动的头像网格；选中描边高亮。

import { Pressable, ScrollView, View } from "react-native";
import type { Avatar as AvatarT } from "@/types";
import { radius, space, usePalette } from "@/theme";
import { Avatar } from "./media";

interface Props {
  avatars: AvatarT[];
  value: string | null;
  onChange: (id: string) => void;
}

export function AvatarPicker({ avatars, value, onChange }: Props) {
  const pal = usePalette();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
      {avatars.map((a) => {
        const selected = value === a.id;
        return (
          <Pressable
            key={a.id}
            onPress={() => onChange(a.id)}
            style={{
              padding: 3,
              borderRadius: radius.full,
              borderWidth: 2,
              borderColor: selected ? pal.brand.primary : "transparent",
            }}
          >
            <View
              style={
                selected
                  ? { shadowColor: pal.brand.primary, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }
                  : undefined
              }
            >
              <Avatar avatarId={a.id} size={52} />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
