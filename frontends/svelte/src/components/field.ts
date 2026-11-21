import type { HTMLInputAttributes } from "svelte/elements";
import type { IconName } from "@/lib/icons";

/** FormField / PasswordField 共用的属性 */
export interface FieldProps {
  id: string;
  label: string;
  type?: string;
  hint?: string;
  error?: string;
  ok?: string;
  /** 琥珀：标签后的星号 */
  req?: boolean;
  /** 琥珀：输入框左侧的图标 */
  lead?: IconName;
  testId?: string;
  /** 出错时提示上的 data-field（测试钩子 field-error 用），默认取 id */
  errorKey?: string;
  autocomplete?: HTMLInputAttributes["autocomplete"];
  placeholder?: string;
  maxlength?: number;
  disabled?: boolean;
  autofocus?: boolean;
}
