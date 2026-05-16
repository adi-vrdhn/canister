import SwiftUI

struct CanisterrBadge: View {
  let text: String
  var tint: Color = CanisterrTheme.accent

  var body: some View {
    Text(text.uppercased())
      .font(.system(size: 10, weight: .black, design: .rounded))
      .tracking(1.4)
      .foregroundStyle(tint)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(
        Capsule(style: .continuous)
          .fill(tint.opacity(0.14))
      )
      .overlay(
        Capsule(style: .continuous)
          .stroke(tint.opacity(0.25), lineWidth: 1)
      )
  }
}

struct CanisterrSectionHeader: View {
  let title: String
  let subtitle: String?
  var trailing: AnyView? = nil

  init<Trailing: View>(title: String, subtitle: String? = nil, @ViewBuilder trailing: () -> Trailing) {
    self.title = title
    self.subtitle = subtitle
    self.trailing = AnyView(trailing())
  }

  init(title: String, subtitle: String? = nil) {
    self.title = title
    self.subtitle = subtitle
    self.trailing = nil
  }

  var body: some View {
    HStack(alignment: .top, spacing: 16) {
      VStack(alignment: .leading, spacing: 6) {
        Text(title)
          .font(.system(size: 24, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        if let subtitle {
          Text(subtitle)
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundStyle(CanisterrTheme.muted)
            .lineLimit(2)
        }
      }
      Spacer(minLength: 8)
      if let trailing {
        trailing
      }
    }
  }
}

struct CanisterrMetricTile: View {
  let value: String
  let label: String
  let icon: String

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Image(systemName: icon)
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(CanisterrTheme.accentSoft)
          .padding(8)
          .background(Circle().fill(CanisterrTheme.accent.opacity(0.12)))
        Spacer()
      }
      Text(value)
        .font(.system(size: 22, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      Text(label)
        .font(.system(size: 12, weight: .medium, design: .rounded))
        .foregroundStyle(CanisterrTheme.muted)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .canisterrCard(padding: 14)
  }
}

struct CanisterrAvatarView: View {
  let name: String
  let avatarURL: URL?
  var diameter: CGFloat = 42

  var body: some View {
    ZStack {
      Circle()
        .fill(
          LinearGradient(
            colors: [CanisterrTheme.accent.opacity(0.95), CanisterrTheme.accentSoft.opacity(0.65)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
      if let avatarURL {
        AsyncImage(url: avatarURL) { image in
          image.resizable().scaledToFill()
        } placeholder: {
          Text(name.initials)
            .font(.system(size: diameter * 0.34, weight: .black, design: .rounded))
            .foregroundStyle(Color.black)
        }
        .clipShape(Circle())
      } else {
        Text(name.initials)
          .font(.system(size: diameter * 0.34, weight: .black, design: .rounded))
          .foregroundStyle(Color.black)
      }
    }
    .frame(width: diameter, height: diameter)
    .overlay(
      Circle()
        .stroke(Color.white.opacity(0.18), lineWidth: 1)
    )
  }
}

struct CanisterrPosterView: View {
  let content: CanisterrContent
  var height: CGFloat = 128

  var body: some View {
    ZStack(alignment: .bottomLeading) {
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .fill(
          LinearGradient(
            colors: [
              Color(red: 0.18, green: 0.18, blue: 0.18),
              Color(red: 0.07, green: 0.07, blue: 0.07)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
      if let url = content.posterURL {
        AsyncImage(url: url) { image in
          image.resizable().scaledToFill()
        } placeholder: {
          fallback
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
      } else {
        fallback
      }

      LinearGradient(
        colors: [.clear, Color.black.opacity(0.8)],
        startPoint: .top,
        endPoint: .bottom
      )
      .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

      VStack(alignment: .leading, spacing: 4) {
        Text(content.contentType.label)
          .font(.system(size: 10, weight: .black, design: .rounded))
          .tracking(1.2)
          .foregroundStyle(CanisterrTheme.accentSoft)
        Text(content.title)
          .font(.system(size: 16, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
          .lineLimit(2)
      }
      .padding(14)
    }
    .frame(height: height)
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .stroke(CanisterrTheme.border, lineWidth: 1)
    )
  }

  private var fallback: some View {
    ZStack {
      LinearGradient(
        colors: [CanisterrTheme.surfaceElevated, Color.black],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      VStack(spacing: 10) {
        Image(systemName: content.contentType == .movie ? "film" : "tv.fill")
          .font(.system(size: 24, weight: .bold))
          .foregroundStyle(CanisterrTheme.accentSoft)
        Text(content.title)
          .font(.system(size: 16, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
          .multilineTextAlignment(.center)
          .padding(.horizontal, 10)
      }
    }
  }
}

struct CanisterrEmptyStateView: View {
  let title: String
  let subtitle: String
  let symbol: String

  var body: some View {
    VStack(spacing: 14) {
      Image(systemName: symbol)
        .font(.system(size: 24, weight: .bold))
        .foregroundStyle(CanisterrTheme.accentSoft)
        .padding(16)
        .background(Circle().fill(CanisterrTheme.accent.opacity(0.12)))
      Text(title)
        .font(.system(size: 18, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      Text(subtitle)
        .font(.system(size: 13, weight: .medium, design: .rounded))
        .foregroundStyle(CanisterrTheme.muted)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 8)
    }
    .frame(maxWidth: .infinity)
    .padding(24)
    .canisterrCard(padding: 20)
  }
}

struct CanisterrLoadingView: View {
  var body: some View {
    ZStack {
      CanisterrBackgroundView()
      VStack(spacing: 18) {
        ProgressView()
          .tint(CanisterrTheme.accent)
          .scaleEffect(1.2)
        Text("Opening Canisterr")
          .font(.system(size: 28, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        Text("Syncing your feed, friends, and lists.")
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
      }
      .padding(28)
      .canisterrCard(padding: 24)
      .frame(maxWidth: 420)
    }
  }
}

extension String {
  var initials: String {
    let parts = self.split(separator: " ")
    let first = parts.first?.prefix(1) ?? ""
    let second = parts.dropFirst().first?.prefix(1) ?? ""
    let value = "\(first)\(second)"
    return value.uppercased().isEmpty ? "C" : value.uppercased()
  }
}

