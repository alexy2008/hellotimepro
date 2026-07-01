// ============================================================
// 设计令牌 → SwiftUI 常量（支持明 / 暗两套，对齐 spec/styles/tokens.css）
//
// 事实源是 tokens.css（语义令牌）+ palette.css（色阶）。本文件镜像两套主题，
// 用 NSColor 动态 provider 让每个语义色随当前外观自动切换；
// 主题切换由 RootView 的 .preferredColorScheme 驱动（见 AppStore.theme）。
//
// 组件层只消费 Theme.* 语义常量，禁止散落硬编码色 —— 与 Web 端
// verify-design-tokens 的纪律对齐（原生侧无脚本拦截，靠约定）。
// ============================================================

import SwiftUI
import UIKit

extension UIColor {
    convenience init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(red: CGFloat((v & 0xFF0000) >> 16) / 255,
                  green: CGFloat((v & 0x00FF00) >> 8) / 255,
                  blue: CGFloat(v & 0x0000FF) / 255,
                  alpha: 1)
    }
}

extension Color {
    /// 单值十六进制色（与 palette.css 写法一致）。
    init(hex: String) { self.init(UIColor(hex: hex)) }

    /// 随外观切换的动态色（明 / 暗各一套）；iOS 用 UIColor 的 trait provider。
    init(lightHex: String, darkHex: String) {
        let dynamic = UIColor { tc in
            UIColor(hex: tc.userInterfaceStyle == .dark ? darkHex : lightHex)
        }
        self.init(dynamic)
    }
}

/// 语义化设计令牌（明 / 暗自适应）。
enum Theme {
    // ===== 背景层 =====
    static let surface0 = Color(lightHex: "#f7f7fb", darkHex: "#06060c") // page bg
    static let surface1 = Color(lightHex: "#ffffff", darkHex: "#0d0d15") // card bg
    static let surface2 = Color(lightHex: "#eeeef4", darkHex: "#181824") // elevated / hover
    static let surface3 = Color(lightHex: "#d7d7e2", darkHex: "#262635") // input bg
    static let surfaceRaised = Color(lightHex: "#ffffff", darkHex: "#181824")

    // ===== 描边 =====
    static let borderSubtle = Color(lightHex: "#d7d7e2", darkHex: "#262635")
    static let borderDefault = Color(lightHex: "#b0b0c0", darkHex: "#3a3a4d")
    static let borderStrong = Color(lightHex: "#80808f", darkHex: "#55556a")
    static let borderFocus = Color(lightHex: "#6b46ff", darkHex: "#8467ff")

    // ===== 文字 =====
    static let textPrimary = Color(lightHex: "#0d0d15", darkHex: "#f7f7fb")
    static let textSecondary = Color(lightHex: "#262635", darkHex: "#d7d7e2")
    static let textMuted = Color(lightHex: "#55556a", darkHex: "#80808f")
    static let textDisabled = Color(lightHex: "#80808f", darkHex: "#55556a")
    static let textLink = Color(lightHex: "#5a34ee", darkHex: "#40e4ff")

    // ===== 品牌 / 强调 / 信号 =====
    static let brandPrimary = Color(lightHex: "#5a34ee", darkHex: "#6b46ff")
    static let brandHover = Color(lightHex: "#6b46ff", darkHex: "#8467ff")
    static let brandPressed = Color(lightHex: "#4824c4", darkHex: "#5a34ee")
    static let brandSubtle = Color(lightHex: "#e4dcff", darkHex: "#341a8f")
    static let brandOn = Color(hex: "#f7f7fb")

    static let accentPrimary = Color(lightHex: "#e01778", darkHex: "#ff2d91")
    static let signalPrimary = Color(lightHex: "#0090a8", darkHex: "#14d4f0")
    static let signalOn = Color(lightHex: "#ffffff", darkHex: "#06060c") // 青底上的文字色
    static let signalHover = Color(lightHex: "#00b8d4", darkHex: "#40e4ff") // --color-signal-hover
    static let signalGlow = Color(hex: "#14d4f0").opacity(0.45)           // --shadow-glow-signal
    static let signalSubtle = Color(lightHex: "#bff7ff", darkHex: "#004b59") // --color-signal-subtle
    static let successGlow = Color(hex: "#5ed49a").opacity(0.45)
    static let successOn = Color(lightHex: "#ffffff", darkHex: "#06060c")   // --color-success-on

    // ===== 流光渐变（hero CTA，对齐 --gradient-primary-flow / --gradient-success-flow） =====
    static let gradientPrimaryFlow = LinearGradient(
        colors: [Color(hex: "#6b46ff"), Color(hex: "#14d4f0"), Color(hex: "#6b46ff")],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let gradientSuccessFlow = LinearGradient(
        colors: [Color(hex: "#1aa866"), Color(hex: "#5ed49a"), Color(hex: "#1aa866")],
        startPoint: .topLeading, endPoint: .bottomTrailing)

    // ===== 状态 =====
    static let successSolid = Color(hex: "#1aa866")
    static let successFg = Color(lightHex: "#0f6b41", darkHex: "#5ed49a")
    static let successBorder = Color(lightHex: "#5ed49a", darkHex: "#0f6b41")
    static let successBg = Color(lightHex: "#e8fbf1", darkHex: "#08402a")
    static let warningSolid = Color(hex: "#f29d0a")
    static let warningFg = Color(lightHex: "#a46400", darkHex: "#ffc14a")
    static let dangerSolid = Color(hex: "#b84040")
    static let dangerFg = Color(lightHex: "#8a2e2e", darkHex: "#d47a7a")
    static let dangerBg = Color(lightHex: "#fdf0f0", darkHex: "#4a1a1a")
    static let infoBg = Color(lightHex: "#e4dcff", darkHex: "#221060")

    // ===== 业务语义 · 胶囊 =====
    static let capsuleSealedBorder = Color(hex: "#00b8d4")
    static let capsuleSealedAccent = Color(lightHex: "#006d80", darkHex: "#40e4ff")
    static let capsuleOpenedBorder = Color(lightHex: "#0f6b41", darkHex: "#1aa866")
    static let capsuleOpenedAccent = Color(lightHex: "#0f6b41", darkHex: "#5ed49a")

    // ===== 收藏 =====
    static let favoriteActive = Color(hex: "#ff2d91")
    static let favoriteInactive = Color(lightHex: "#80808f", darkHex: "#80808f")

    // ===== 品牌渐变（hero / 标题） =====
    static let brandGradient = LinearGradient(
        colors: [Color(hex: "#40e4ff"), Color(hex: "#ff4fa0"), Color(hex: "#5ed49a")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    // ===== Hero 背景（对齐 --gradient-brand-subtle + ::before 径向紫光） =====
    static let gradientBrandSubtle = LinearGradient(
        colors: [Color(hex: "#14d4f0").opacity(0.15), Color(hex: "#ff4fa0").opacity(0.10), Color(hex: "#5ed49a").opacity(0.08)],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let heroGlow = Color(hex: "#6b46ff").opacity(0.28) // 径向光晕中心色

    // ===== 卡片流光描边 + 外发光（对齐 --gradient-cyber-flow / --gradient-mint-flow） =====
    static let gradientCyberFlow = LinearGradient(  // 未开启边框：青 → 品红 → 绿
        colors: [Color(hex: "#14d4f0"), Color(hex: "#ff2d91"), Color(hex: "#1aa866")],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let gradientMintFlow = LinearGradient(   // 已开启边框：绿 → 紫 → 绿
        colors: [Color(hex: "#1aa866"), Color(hex: "#6b46ff"), Color(hex: "#1aa866")],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let capsuleSealedGlow = Color(hex: "#14d4f0").opacity(0.45) // --color-capsule-sealed-glow
    static let capsuleOpenedGlow = Color(hex: "#5ed49a").opacity(0.38) // --color-capsule-opened-glow
}

/// 间距（8pt grid，单位 pt）。
enum Space {
    static let s1: CGFloat = 4
    static let s2: CGFloat = 8
    static let s3: CGFloat = 12
    static let s4: CGFloat = 16
    static let s5: CGFloat = 20
    static let s6: CGFloat = 24
    static let s8: CGFloat = 32
    static let s10: CGFloat = 40
    static let s12: CGFloat = 48
    static let s16: CGFloat = 64
}

/// 圆角。
enum Radius {
    static let xs: CGFloat = 2
    static let sm: CGFloat = 4
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let xxl: CGFloat = 24
    static let full: CGFloat = 999
}

/// 字号（pt，1rem = 16）。
enum FontSize {
    static let xs: CGFloat = 12
    static let sm: CGFloat = 14
    static let base: CGFloat = 16
    static let lg: CGFloat = 18
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let xxxl: CGFloat = 30
    static let xxxxl: CGFloat = 36
    static let display: CGFloat = 44
}

/// 布局常量。
enum Layout {
    static let headerHeight: CGFloat = 64
    static let containerMax: CGFloat = 1200
    static let containerNarrow: CGFloat = 720
}
