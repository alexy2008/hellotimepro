import type { IconName } from "@/lib/icons";

/** 分段控件的一个选项 */
export interface SegOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  count?: number | null;
}
