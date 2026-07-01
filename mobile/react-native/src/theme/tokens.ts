// ============================================================
// 自动生成 · 请勿手改 (AUTO-GENERATED — DO NOT EDIT)
//
// 由 scripts/gen-tokens-rn 从 spec/tokens/tokens.json 生成。
// 重新生成：node scripts/gen-tokens-rn
// 源（事实源）：spec/styles/tokens.css → spec/tokens/tokens.json
//
// rem 已折算为 px 数字（1rem=16px）；颜色/渐变保留原字符串。
// 消费入口见 src/theme/index.ts。
// ============================================================

export const tokens = {
  semantic: {
    dark: {
      surface: {
        "0": "#06060c",
        "1": "#0d0d15",
        "2": "#181824",
        "3": "#262635",
        raised: "#181824",
        overlay: "rgba(6, 6, 12, 0.72)",
      },
      border: {
        subtle: "#262635",
        default: "#3a3a4d",
        strong: "#55556a",
        focus: "#8467ff",
      },
      text: {
        primary: "#f7f7fb",
        secondary: "#d7d7e2",
        muted: "#80808f",
        disabled: "#55556a",
        inverse: "#0d0d15",
        link: "#40e4ff",
        linkHover: "#80efff",
      },
      brand: {
        primary: "#6b46ff",
        hover: "#8467ff",
        pressed: "#5a34ee",
        subtle: "#341a8f",
        on: "#f7f7fb",
      },
      accent: {
        primary: "#ff2d91",
        hover: "#ff4fa0",
        subtle: "#7e0844",
        on: "#f7f7fb",
      },
      signal: {
        primary: "#14d4f0",
        hover: "#40e4ff",
        subtle: "#004b59",
        on: "#06060c",
      },
      success: {
        bg: "#08402a",
        fg: "#5ed49a",
        border: "#0f6b41",
        solid: "#1aa866",
        on: "#06060c",
      },
      warning: {
        bg: "#5a3700",
        fg: "#ffc14a",
        border: "#a46400",
        solid: "#f29d0a",
      },
      danger: {
        bg: "#4a1a1a",
        fg: "#d47a7a",
        border: "#8a2e2e",
        solid: "#b84040",
      },
      plaza: {
        cardBg: "#0d0d15",
        cardHover: "#181824",
        cardBorder: "#262635",
        divider: "#181824",
        glow: "rgba(107, 70, 255, 0.35)",
      },
      capsule: {
        sealed: {
          border: "#00b8d4",
          accent: "#40e4ff",
          glow: "0 0 24px rgba(20, 212, 240, 0.45)",
        },
        opened: {
          subtle: "#08402a",
          border: "#1aa866",
          accent: "#5ed49a",
          glow: "0 0 18px rgba(94, 212, 154, 0.38)",
        },
      },
      favorite: {
        active: "#ff2d91",
        inactive: "#80808f",
      },
      gradient: {
        brandHero: "linear-gradient(135deg, #40e4ff 0%, #ff4fa0 50%, #5ed49a 100%)",
        brandSubtle: "linear-gradient(135deg, rgba(20,212,240,0.15), rgba(255,79,160,0.10), rgba(94,212,154,0.08))",
      },
    },
    light: {
      surface: {
        "0": "#f7f7fb",
        "1": "#ffffff",
        "2": "#eeeef4",
        "3": "#d7d7e2",
        raised: "#ffffff",
        overlay: "rgba(13, 13, 21, 0.48)",
      },
      border: {
        subtle: "#d7d7e2",
        default: "#b0b0c0",
        strong: "#80808f",
        focus: "#6b46ff",
      },
      text: {
        primary: "#0d0d15",
        secondary: "#262635",
        muted: "#55556a",
        disabled: "#80808f",
        inverse: "#f7f7fb",
        link: "#5a34ee",
        linkHover: "#6b46ff",
      },
      brand: {
        primary: "#5a34ee",
        hover: "#6b46ff",
        pressed: "#4824c4",
        subtle: "#e4dcff",
        on: "#ffffff",
      },
      accent: {
        primary: "#e01778",
        hover: "#ff2d91",
        subtle: "#ffd9ec",
        on: "#ffffff",
      },
      signal: {
        primary: "#0090a8",
        hover: "#00b8d4",
        subtle: "#bff7ff",
        on: "#ffffff",
      },
      success: {
        bg: "#e8fbf1",
        fg: "#0f6b41",
        border: "#5ed49a",
        solid: "#1aa866",
        on: "#ffffff",
      },
      warning: {
        bg: "#fff5e0",
        fg: "#a46400",
        border: "#ffc14a",
        solid: "#f29d0a",
      },
      danger: {
        bg: "#fdf0f0",
        fg: "#8a2e2e",
        border: "#d47a7a",
        solid: "#b84040",
      },
      plaza: {
        cardBg: "#ffffff",
        cardHover: "#f7f7fb",
        cardBorder: "#d7d7e2",
        divider: "#eeeef4",
        glow: "rgba(107, 70, 255, 0.18)",
      },
      capsule: {
        sealed: {
          border: "#00b8d4",
          accent: "#006d80",
          glow: "0 0 18px rgba(0, 184, 212, 0.22)",
        },
        opened: {
          subtle: "#c2f2d8",
          border: "#1aa866",
          accent: "#0f6b41",
          glow: "0 0 12px rgba(94, 212, 154, 0.20)",
        },
      },
      favorite: {
        active: "#ff2d91",
        inactive: "#80808f",
      },
      gradient: {
        brandHero: "linear-gradient(135deg, #14d4f0 0%, #ff2d91 50%, #1aa866 100%)",
        brandSubtle: "linear-gradient(135deg, rgba(20,212,240,0.10), rgba(255,45,145,0.07), rgba(26,168,102,0.06))",
      },
    },
  },
  typography: {
    fontFamily: {
      sans: "\"Inter\", \"HarmonyOS Sans SC\", \"PingFang SC\", -apple-system, \"Segoe UI\", \"Roboto\", \"Helvetica Neue\", \"Noto Sans CJK SC\", sans-serif",
      mono: "\"JetBrains Mono\", \"Fira Code\", \"SF Mono\", Menlo, Consolas, monospace",
      display: "\"Orbitron\", \"Exo 2\", \"Inter\", \"HarmonyOS Sans SC\", \"PingFang SC\", sans-serif",
    },
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
      "5xl": 48,
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.35,
      normal: 1.5,
      relaxed: 1.7,
    },
    fontWeight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
  space: {
    "0": 0,
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "16": 64,
    "20": 80,
  },
  radius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    "2xl": 24,
    full: 9999,
  },
  shadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.25)",
    md: "0 4px 12px rgba(0, 0, 0, 0.28)",
    lg: "0 12px 32px rgba(0, 0, 0, 0.38)",
    xl: "0 24px 64px rgba(0, 0, 0, 0.48)",
    glowBrand: "0 0 24px rgba(107, 70, 255, 0.45)",
    glowSignal: "0 0 24px rgba(20, 212, 240, 0.45)",
    glowAccent: "0 0 24px rgba(255, 45, 145, 0.45)",
  },
  layout: {
    containerMax: 1200,
    containerNarrow: 720,
    headerHeight: 64,
    footerHeight: 64,
  },
  motion: {
    duration: {
      instant: 80,
      fast: 140,
      normal: 220,
      slow: 360,
      breath: 3200,
    },
    easing: {
      standard: "cubic-bezier(0.4, 0.0, 0.2, 1)",
      emphasized: "cubic-bezier(0.2, 0.0, 0, 1)",
      decel: "cubic-bezier(0.0, 0.0, 0.2, 1)",
      accel: "cubic-bezier(0.4, 0.0, 1, 1)",
    },
  },
  zIndex: {
    base: 0,
    raised: 10,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1200,
    modal: 1300,
    toast: 1400,
  },
  breakpoint: {
    sm: 360,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
} as const;

export type Tokens = typeof tokens;
export type ThemeMode = keyof Tokens["semantic"]; // "dark" | "light"
