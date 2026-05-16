import SwiftUI

struct CanisterrRootView: View {
  @EnvironmentObject private var store: CanisterrStore
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  var body: some View {
    Group {
      switch store.session {
      case .loading:
        CanisterrLoadingView()
      case .signedOut:
        CanisterrAuthView()
      case .signedIn:
        if horizontalSizeClass == .compact {
          CanisterrTabShellView()
        } else {
          CanisterrSidebarShellView()
        }
      }
    }
    .background(CanisterrBackgroundView())
    .alert(
      "Canisterr",
      isPresented: Binding(
        get: { store.bannerMessage != nil },
        set: { if !$0 { store.bannerMessage = nil } }
      ),
      actions: {
        Button("OK", role: .cancel) {
          store.bannerMessage = nil
        }
      },
      message: {
        Text(store.bannerMessage ?? "")
      }
    )
    .task {
      if case .loading = store.session {
        await store.bootstrap()
      }
    }
  }
}

struct CanisterrSidebarShellView: View {
  @EnvironmentObject private var store: CanisterrStore

  var body: some View {
    NavigationSplitView {
      CanisterrSidebarView()
    } detail: {
      CanisterrSectionHostView(section: store.selectedSection)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
    .navigationSplitViewStyle(.balanced)
  }
}

struct CanisterrTabShellView: View {
  @EnvironmentObject private var store: CanisterrStore

  var body: some View {
    TabView(selection: $store.selectedSection) {
      ForEach(CanisterrSection.allCases) { section in
        NavigationStack {
          CanisterrSectionHostView(section: section)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .tabItem {
          Label(section.title, systemImage: section.symbol)
        }
        .tag(section)
      }
    }
    .tint(CanisterrTheme.accent)
  }
}

struct CanisterrSidebarView: View {
  @EnvironmentObject private var store: CanisterrStore

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        VStack(alignment: .leading, spacing: 12) {
          HStack(spacing: 12) {
            ZStack {
              RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                  LinearGradient(
                    colors: [CanisterrTheme.accent, CanisterrTheme.accentSoft],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                  )
                )
                .frame(width: 52, height: 52)
              Image(systemName: "film.stack.fill")
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(Color.black)
            }
            VStack(alignment: .leading, spacing: 4) {
              Text("Canisterr")
                .font(.system(size: 24, weight: .black, design: .rounded))
                .foregroundStyle(CanisterrTheme.text)
              Text("Phase 1 and Phase 2 native shell")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundStyle(CanisterrTheme.muted)
            }
          }
          .padding(.bottom, 4)

          if let user = store.currentUser {
            HStack(spacing: 12) {
              CanisterrAvatarView(name: user.name, avatarURL: user.avatarURL, diameter: 44)
              VStack(alignment: .leading, spacing: 4) {
                Text(user.name)
                  .font(.system(size: 15, weight: .bold, design: .rounded))
                  .foregroundStyle(CanisterrTheme.text)
                Text("@\(user.username)")
                  .font(.system(size: 12, weight: .medium, design: .rounded))
                  .foregroundStyle(CanisterrTheme.muted)
              }
            }
            .padding(14)
            .background(
              RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(CanisterrTheme.surfaceElevated)
            )
            .overlay(
              RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(CanisterrTheme.border, lineWidth: 1)
            )
          }
        }
        .padding(.top, 4)

        ForEach(CanisterrPhase.allCases) { phase in
          VStack(alignment: .leading, spacing: 10) {
            HStack {
              CanisterrBadge(text: phase.rawValue, tint: phase == .phase1 ? CanisterrTheme.accent : CanisterrTheme.success)
              Text(phase.subtitle)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(CanisterrTheme.muted)
            }
            VStack(spacing: 8) {
              ForEach(CanisterrSection.allCases.filter { $0.phase == phase }) { section in
                Button {
                  store.selectedSection = section
                } label: {
                  HStack(spacing: 12) {
                    Image(systemName: section.symbol)
                      .frame(width: 20)
                    Text(section.title)
                      .font(.system(size: 15, weight: .bold, design: .rounded))
                    Spacer()
                    if section.phase == .phase2 {
                      Text("Phase 2")
                        .font(.system(size: 10, weight: .black, design: .rounded))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(CanisterrTheme.accent.opacity(0.12)))
                    }
                  }
                  .foregroundStyle(store.selectedSection == section ? Color.black : CanisterrTheme.text)
                  .padding(.horizontal, 14)
                  .padding(.vertical, 12)
                  .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                      .fill(store.selectedSection == section ? CanisterrTheme.text : Color.white.opacity(0.03))
                  )
                  .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                      .stroke(store.selectedSection == section ? Color.clear : CanisterrTheme.border, lineWidth: 1)
                  )
                }
                .buttonStyle(.plain)
              }
            }
          }
        }

        VStack(alignment: .leading, spacing: 12) {
          Button("Sign out") {
            Task { await store.signOut() }
          }
          .buttonStyle(CanisterrSecondaryButtonStyle())
          .frame(maxWidth: .infinity, alignment: .leading)

          Text("Built for the same social-movie flow as the web app.")
            .font(.system(size: 11, weight: .medium, design: .rounded))
            .foregroundStyle(CanisterrTheme.subtle)
        }
        .padding(.top, 8)
      }
      .padding(18)
    }
    .background(CanisterrTheme.background)
  }
}

struct CanisterrSectionHostView: View {
  let section: CanisterrSection

  var body: some View {
    switch section {
    case .dashboard:
      CanisterrDashboardView()
    case .share:
      CanisterrShareComposerView()
    case .friends:
      CanisterrFriendsView()
    case .lists:
      CanisterrListsView()
    case .logs:
      CanisterrLogsView()
    case .notifications:
      CanisterrNotificationsView()
    case .settings:
      CanisterrSettingsView()
    }
  }
}
