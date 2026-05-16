import SwiftUI

struct CanisterrFriendsView: View {
  @EnvironmentObject private var store: CanisterrStore
  @State private var activeTab: FriendTab = .search
  @State private var search = ""

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        CanisterrSectionHeader(title: "Friends", subtitle: "Search, follow, and accept requests.")
        Picker("Friends", selection: $activeTab) {
          ForEach(FriendTab.allCases) { tab in
            Text(tab.title).tag(tab)
          }
        }
        .pickerStyle(.segmented)
        .tint(CanisterrTheme.accent)

        switch activeTab {
        case .search:
          searchTab
        case .following:
          peopleTab(title: "Following", emptyTitle: "No one followed yet", emptySubtitle: "Search and send your first request.", users: store.snapshot.following, actionTitle: "Unfollow") { _ in }
        case .followers:
          peopleTab(title: "Followers", emptyTitle: "No followers yet", emptySubtitle: "Your people will show up here.", users: store.snapshot.followers, actionTitle: "View") { _ in }
        case .requests:
          peopleTab(title: "Requests", emptyTitle: "No requests", emptySubtitle: "Incoming requests land here.", users: store.snapshot.pendingRequests, actionTitle: "Accept", action: { user in
            Task { await store.acceptFollow(user) }
          })
        }
      }
      .padding(.vertical, 8)
    }
    .task(id: search) {
      if activeTab == .search {
        await store.runRecipientSearch()
      }
    }
  }

  private var searchTab: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        Image(systemName: "magnifyingglass")
          .foregroundStyle(CanisterrTheme.subtle)
        TextField("Search users", text: $search)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .foregroundStyle(CanisterrTheme.text)
          .onChange(of: search) { _, newValue in
            store.recipientQuery = newValue
            Task { await store.runRecipientSearch() }
          }
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 14)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(CanisterrTheme.surfaceElevated)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )

      peopleTab(
        title: "Search results",
        emptyTitle: "No matches",
        emptySubtitle: "Try a different name or username.",
        users: store.recipientResults,
        actionTitle: "Follow",
        action: { user in
          Task { await store.follow(user) }
        }
      )
    }
  }

  private func peopleTab(
    title: String,
    emptyTitle: String,
    emptySubtitle: String,
    users: [CanisterrUser],
    actionTitle: String,
    action: @escaping (CanisterrUser) -> Void
  ) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(title)
        .font(.system(size: 13, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      if users.isEmpty {
        CanisterrEmptyStateView(
          title: emptyTitle,
          subtitle: emptySubtitle,
          symbol: "person.crop.circle"
        )
      } else {
        VStack(spacing: 10) {
          ForEach(users) { user in
            HStack(spacing: 12) {
              CanisterrAvatarView(name: user.name, avatarURL: user.avatarURL, diameter: 40)
              VStack(alignment: .leading, spacing: 4) {
                HStack {
                  Text(user.name)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(CanisterrTheme.text)
                  if user.isVerified {
                    Image(systemName: "checkmark.seal.fill")
                      .foregroundStyle(CanisterrTheme.accentSoft)
                  }
                  Spacer()
                }
                Text("@\(user.username)")
                  .font(.system(size: 12, weight: .medium, design: .rounded))
                  .foregroundStyle(CanisterrTheme.muted)
                if let bio = user.bio {
                  Text(bio)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(CanisterrTheme.subtle)
                    .lineLimit(2)
                }
              }
              Button(actionTitle) {
                action(user)
              }
              .buttonStyle(CanisterrSecondaryButtonStyle())
            }
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
      }
    }
  }
}

private enum FriendTab: String, CaseIterable, Identifiable {
  case search
  case following
  case followers
  case requests

  var id: String { rawValue }

  var title: String {
    switch self {
    case .search: return "Search"
    case .following: return "Following"
    case .followers: return "Followers"
    case .requests: return "Requests"
    }
  }
}

