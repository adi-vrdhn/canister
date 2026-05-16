import SwiftUI

enum CanisterrTheme {
  static let background = Color(red: 0.03, green: 0.03, blue: 0.03)
  static let backgroundGlow = Color(red: 0.09, green: 0.06, blue: 0.03)
  static let surface = Color(red: 0.08, green: 0.08, blue: 0.08)
  static let surfaceElevated = Color(red: 0.11, green: 0.11, blue: 0.11)
  static let border = Color.white.opacity(0.1)
  static let text = Color(red: 0.96, green: 0.94, blue: 0.87)
  static let muted = Color.white.opacity(0.58)
  static let subtle = Color.white.opacity(0.38)
  static let accent = Color(red: 1.0, green: 0.48, blue: 0.10)
  static let accentSoft = Color(red: 1.0, green: 0.70, blue: 0.42)
  static let success = Color(red: 0.18, green: 0.77, blue: 0.73)
  static let danger = Color(red: 0.93, green: 0.43, blue: 0.36)
  static let warning = Color(red: 0.95, green: 0.79, blue: 0.28)
}

struct CanisterrBackgroundView: View {
  var body: some View {
    ZStack {
      CanisterrTheme.background
      RadialGradient(
        colors: [
          CanisterrTheme.backgroundGlow.opacity(0.75),
          CanisterrTheme.background.opacity(0.0)
        ],
        center: .topLeading,
        startRadius: 0,
        endRadius: 520
      )
      .blendMode(.screen)
      .ignoresSafeArea()

      LinearGradient(
        colors: [
          .clear,
          Color.white.opacity(0.02),
          .clear
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .blendMode(.screen)
      .ignoresSafeArea()
    }
  }
}

struct CanisterrCardModifier: ViewModifier {
  var padding: CGFloat = 16

  func body(content: Content) -> some View {
    content
      .padding(padding)
      .background(
        RoundedRectangle(cornerRadius: 28, style: .continuous)
          .fill(CanisterrTheme.surface)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 28, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )
      .shadow(color: Color.black.opacity(0.35), radius: 18, x: 0, y: 10)
  }
}

extension View {
  func canisterrCard(padding: CGFloat = 16) -> some View {
    modifier(CanisterrCardModifier(padding: padding))
  }
}

struct CanisterrPrimaryButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.system(size: 16, weight: .black, design: .rounded))
      .foregroundStyle(Color.black)
      .padding(.horizontal, 18)
      .padding(.vertical, 13)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(CanisterrTheme.text.opacity(configuration.isPressed ? 0.88 : 1.0))
      )
      .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
  }
}

struct CanisterrSecondaryButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.system(size: 15, weight: .semibold, design: .rounded))
      .foregroundStyle(CanisterrTheme.text)
      .padding(.horizontal, 16)
      .padding(.vertical, 11)
      .background(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(Color.white.opacity(configuration.isPressed ? 0.05 : 0.035))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )
      .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
  }
}

