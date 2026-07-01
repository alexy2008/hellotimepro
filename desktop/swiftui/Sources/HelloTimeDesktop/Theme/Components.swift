// ============================================================
// 复用样式：按钮（变体 × 尺寸）、卡片、输入框、Alert、占位头像。
// 对齐 React 的 cy-btn / cy-card / cy-alert 等类。
// ============================================================

import SwiftUI

// MARK: - 字体

extension Font {
    /// 赛博风标题：token 指定 Orbitron（未安装），原生退化为系统 rounded 重字。
    static func display(_ size: CGFloat) -> Font { .system(size: size, weight: .bold, design: .rounded) }
}

// MARK: - 卡片

private struct CardModifier: ViewModifier {
    var padding: CGFloat
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.surface1)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous).stroke(Theme.borderSubtle, lineWidth: 1))
    }
}
extension View {
    func cardStyle(padding: CGFloat = Space.s6) -> some View { modifier(CardModifier(padding: padding)) }
}

// MARK: - 按钮

// 对齐 cyber.css：primary=signal 青、success=薄荷绿、ghost=描边、hero*=流光渐变。
// 紫色(brand)不作主按钮色，只用于标题/品牌点缀。
enum BtnVariant { case primary, ghost, success, accent, danger, heroPrimary, heroSuccess }
enum BtnSize { case sm, md, lg }

struct HTButtonStyle: ButtonStyle {
    var variant: BtnVariant = .primary
    var size: BtnSize = .md
    var fullWidth: Bool = false

    private var isHero: Bool { variant == .heroPrimary || variant == .heroSuccess }
    private var vPad: CGFloat { isHero ? 16 : (size == .sm ? 6 : size == .md ? 10 : 14) }
    private var hPad: CGFloat { isHero ? 40 : (size == .sm ? 12 : size == .md ? 18 : 24) }
    private var fontSize: CGFloat { isHero ? FontSize.lg : (size == .sm ? FontSize.sm : size == .md ? FontSize.base : FontSize.lg) }

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        let shape: AnyShape = isHero ? AnyShape(Capsule()) : AnyShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        return configuration.label
            .font(.system(size: fontSize, weight: isHero ? .bold : .semibold))
            .foregroundStyle(fg)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .padding(.vertical, vPad)
            .padding(.horizontal, hPad)
            .background(bgStyle(pressed), in: shape)
            .overlay { if variant == .ghost { shape.stroke(Theme.borderDefault, lineWidth: 1) } }
            .shadow(color: glow, radius: glow == .clear ? 0 : 14)
            .opacity(pressed ? 0.9 : 1)
            .scaleEffect(isHero && pressed ? 0.98 : 1)
    }

    private var fg: Color {
        switch variant {
        case .primary: return Theme.signalOn
        case .success: return Theme.successOn
        case .heroPrimary, .heroSuccess: return .white
        case .ghost: return Theme.textPrimary
        case .accent: return Theme.textPrimary
        case .danger: return Theme.dangerFg
        }
    }
    private func bgStyle(_ pressed: Bool) -> AnyShapeStyle {
        switch variant {
        case .primary: return AnyShapeStyle(pressed ? Theme.signalHover : Theme.signalPrimary)
        case .success: return AnyShapeStyle(Theme.successSolid.opacity(pressed ? 0.85 : 1))
        case .heroPrimary: return AnyShapeStyle(Theme.gradientPrimaryFlow)
        case .heroSuccess: return AnyShapeStyle(Theme.gradientSuccessFlow)
        case .ghost: return AnyShapeStyle(pressed ? Theme.surface2 : Color.clear)
        case .accent: return AnyShapeStyle(pressed ? Theme.surface2 : Theme.surface2.opacity(0.6))
        case .danger: return AnyShapeStyle(pressed ? Theme.dangerBg : Color.clear)
        }
    }
    private var glow: Color {
        switch variant {
        case .primary, .heroPrimary: return Theme.signalGlow
        case .success, .heroSuccess: return Theme.successGlow
        default: return .clear
        }
    }
}

extension ButtonStyle where Self == HTButtonStyle {
    static func ht(_ variant: BtnVariant = .primary, _ size: BtnSize = .md, fullWidth: Bool = false) -> HTButtonStyle {
        HTButtonStyle(variant: variant, size: size, fullWidth: fullWidth)
    }
}

// MARK: - 输入框

struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .textFieldStyle(.plain)
            .font(.system(size: FontSize.base))
            .foregroundStyle(Theme.textPrimary)
            .padding(.vertical, Space.s3)
            .padding(.horizontal, Space.s4)
            .background(Theme.surface3)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(Theme.borderDefault, lineWidth: 1))
    }
}
extension View { func fieldStyle() -> some View { modifier(FieldStyle()) } }

struct FieldLabel: View {
    let text: String
    var hint: String? = nil
    var body: some View {
        HStack(spacing: Space.s2) {
            Text(text).font(.system(size: FontSize.sm, weight: .medium)).foregroundStyle(Theme.textSecondary)
            if let hint { Text(hint).font(.system(size: FontSize.sm)).foregroundStyle(Theme.textMuted) }
        }
    }
}

// MARK: - Alert

enum AlertVariant { case info, success, danger }

struct HTAlert: View {
    var variant: AlertVariant = .info
    let text: String

    private var icon: String { switch variant { case .info: "info.circle.fill"; case .success: "checkmark.circle.fill"; case .danger: "exclamationmark.triangle.fill" } }
    private var fg: Color { switch variant { case .info: Theme.textLink; case .success: Theme.successFg; case .danger: Theme.dangerFg } }
    private var bg: Color { switch variant { case .info: Theme.infoBg; case .success: Theme.successBg; case .danger: Theme.dangerBg } }

    var body: some View {
        HStack(alignment: .top, spacing: Space.s3) {
            Image(systemName: icon).foregroundStyle(fg)
            Text(text).font(.system(size: FontSize.sm)).foregroundStyle(Theme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(Space.s3)
        .background(bg.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).stroke(fg.opacity(0.3), lineWidth: 1))
    }
}

// MARK: - 占位头像（远程 SVG 加载前 / 失败兜底）

struct AvatarBadge: View {
    let nickname: String
    var size: CGFloat = 36
    private var initial: String { String(nickname.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased() }
    var body: some View {
        Circle().fill(Theme.brandPrimary.gradient)
            .frame(width: size, height: size)
            .overlay(Text(initial.isEmpty ? "?" : initial).font(.system(size: size * 0.45, weight: .bold)).foregroundStyle(.white))
    }
}
