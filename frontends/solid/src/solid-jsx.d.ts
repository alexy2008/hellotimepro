// Solid 的 JSX 类型里漏了几个标准 SVG 属性（原型的标记用到了），在这里补上。
// 只扩充类型，运行时 Solid 照常把它们写成属性。
import "solid-js";

declare module "solid-js" {
  namespace JSX {
    interface SvgSVGAttributes<T> {
      focusable?: "true" | "false";
    }
    interface TextPathSVGAttributes<T> {
      textLength?: number | string;
      lengthAdjust?: "spacing" | "spacingAndGlyphs";
    }
  }
}
