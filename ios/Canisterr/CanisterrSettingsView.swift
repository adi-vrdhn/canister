import SwiftUI

struct CanisterrSettingsView: View {
  @EnvironmentObject private var store: CanisterrStore
  @State private var pushAlerts = true
  @State private var privateProfile = false
  @State private var autoplayPreviews = true

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        CanisterrSectionHeader(title: "Settings", subtitle: "Phase 2: account, privacy, and app shell.")

        if let user = store.currentUser {
          VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
              CanisterrAvatarView(name: user.name, avatarURL: user.avatarURL, diameter: 52)
              VStack(alignment: .leading, spacing: 6) {
                Text(user.name)
                  .font(.system(size: 18, weight: .black, design: .rounded))
                  .foregroundStyle(CanisterrTheme.text)
                Text("@\(user.username)")
                  .font(.system(size: 13, weight: .medium, design: .rounded))
                  .foregroundStyle(CanisterrTheme.muted)
                Text(user.bio ?? "No bio yet.")
                  .font(.system(size: 12, weight: .medium, design: .rounded))
                  .foregroundStyle(CanisterrTheme.subtle)
              }
            }
            HStack {
              labelValue("Followers", "\(user.followersCount)")
              labelValue("Following", "\(user.followingCount)")
            }
          }
          .padding(16)
          .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
              .fill(CanisterrTheme.surface)
          )
          .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
              .stroke(CanisterrTheme.border, lineWidth: 1)
          )
        }

        settingsToggle(title: "Push alerts", subtitle: "Follow requests, shares, and log replies.", isOn: $pushAlerts)
        settingsToggle(title: "Private profile", subtitle: "Hide your profile from discovery surfaces.", isOn: $privateProfile)
        settingsToggle(title: "Autoplay previews", subtitle: "Show richer media on cards and lists.", isOn: $autoplayPreviews)

        Button {
          Task { await store.signOut() }
        } label: {
          HStack {
            Text("Sign out")
            Spacer()
            Image(systemName: "rectangle.portrait.and.arrow.right")
          }
        }
        .buttonStyle(CanisterrSecondaryButtonStyle())
      }
      .padding(.vertical, 8)
    }
  }

  private func labelValue(_ label: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(value)
        .font(.system(size: 18, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      Text(label)
        .font(.system(size: 11, weight: .medium, design: .rounded))
        .foregroundStyle(CanisterrTheme.muted)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(14)
    .background(
      RoundedRectangle(cornerRadius: 20, style: .continuous)
        .fill(CanisterrTheme.surfaceElevated)
    )
  }

  private func settingsToggle(title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
    Toggle(isOn: isOn) {
      VStack(alignment: .leading, spacing: 4) {
        Text(title)
          .font(.system(size: 15, weight: .bold, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        Text(subtitle)
          .font(.system(size: 12, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
      }
    }
    .toggleStyle(SwitchToggleStyle(tint: CanisterrTheme.accent))
    .padding(14)
    .background(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .fill(CanisterrTheme.surface)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(CanisterrTheme.border, lineWidth: 1)
    )
  }
}

