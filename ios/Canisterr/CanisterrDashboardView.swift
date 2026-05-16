import SwiftUI

struct CanisterrDashboardView: View {
  @EnvironmentObject private var store: CanisterrStore
  @State private var showShareComposer = false
  @State private var showLogSheet = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        header
        metrics
        quickActions
        sharesSection
        activitySection
        roadmapSection
      }
      .padding(.vertical, 8)
    }
    .sheet(isPresented: $showShareComposer) {
      NavigationStack {
        CanisterrShareComposerView()
      }
      .presentationDetents([.large])
    }
    .sheet(isPresented: $showLogSheet) {
      NavigationStack {
        CanisterrLogsView(composeMode: true)
      }
      .presentationDetents([.large])
    }
  }

  private var header: some View {
    CanisterrSectionHeader(
      title: "Dashboard",
      subtitle: "Same social movie flow, now native."
    ) {
      HStack(spacing: 10) {
        Button {
          showShareComposer = true
        } label: {
          Image(systemName: "plus")
        }
        .buttonStyle(CanisterrSecondaryButtonStyle())

        Button {
          showLogSheet = true
        } label: {
          HStack(spacing: 8) {
            Image(systemName: "film.fill")
            Text("Log")
          }
        }
        .buttonStyle(CanisterrPrimaryButtonStyle())
      }
    }
  }

  private var metrics: some View {
    let shares = store.snapshot.dashboard.incomingShares
    let activity = store.snapshot.dashboard.friendActivity
    let lists = store.snapshot.lists
    return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
      CanisterrMetricTile(value: "\(shares.count)", label: "Incoming shares", icon: "arrowshape.turn.up.right.fill")
      CanisterrMetricTile(value: "\(activity.count)", label: "Friend activity items", icon: "person.2.fill")
      CanisterrMetricTile(value: "\(lists.count)", label: "Lists in orbit", icon: "rectangle.stack.fill")
      CanisterrMetricTile(value: "\(store.unreadNotificationCount)", label: "Unread notifications", icon: "bell.fill")
    }
  }

  private var quickActions: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Quick actions")
        .font(.system(size: 13, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 12) {
          actionButton(title: "Share a movie", symbol: "arrowshape.turn.up.right.fill") {
            showShareComposer = true
          }
          actionButton(title: "Log watched", symbol: "film.stack.fill") {
            showLogSheet = true
          }
          actionButton(title: "Find friends", symbol: "person.2.fill") {
            store.selectedSection = .friends
          }
          actionButton(title: "Build a list", symbol: "rectangle.stack.fill") {
            store.selectedSection = .lists
          }
        }
      }
    }
  }

  private var sharesSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      CanisterrSectionHeader(title: "Incoming shares", subtitle: "What your people sent you.")
      if store.snapshot.dashboard.incomingShares.isEmpty {
        CanisterrEmptyStateView(
          title: "No shares yet",
          subtitle: "Once people start sending movies, they will show up here.",
          symbol: "tray"
        )
      } else {
        VStack(spacing: 12) {
          ForEach(store.snapshot.dashboard.incomingShares) { share in
            shareCard(share)
          }
        }
      }
    }
  }

  private var activitySection: some View {
    VStack(alignment: .leading, spacing: 12) {
      CanisterrSectionHeader(title: "Friend activity", subtitle: "Recent watches and reactions.")
      if store.snapshot.dashboard.friendActivity.isEmpty {
        CanisterrEmptyStateView(
          title: "Nothing new",
          subtitle: "Recent watches and reviews will appear as your network grows.",
          symbol: "clock"
        )
      } else {
        VStack(spacing: 12) {
          ForEach(store.snapshot.dashboard.friendActivity) { activity in
            activityCard(activity)
          }
        }
      }
    }
  }

  private var roadmapSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      CanisterrSectionHeader(title: "Phase roadmap", subtitle: "The same app, shipped in order.")
      VStack(spacing: 12) {
        roadmapCard(
          phase: .phase1,
          title: "Phase 1",
          bullets: ["Auth", "Dashboard", "Movie share flow", "Friends", "Profile shell"]
        )
        roadmapCard(
          phase: .phase2,
          title: "Phase 2",
          bullets: ["Lists", "Watch logs", "Notifications", "Settings", "Feed refinements"]
        )
      }
    }
  }

  private func actionButton(title: String, symbol: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      VStack(alignment: .leading, spacing: 12) {
        Image(systemName: symbol)
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(CanisterrTheme.accentSoft)
          .padding(12)
          .background(Circle().fill(CanisterrTheme.accent.opacity(0.12)))
        Text(title)
          .font(.system(size: 14, weight: .bold, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
      }
      .frame(width: 150, alignment: .leading)
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 22, style: .continuous)
          .fill(CanisterrTheme.surfaceElevated)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 22, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )
    }
    .buttonStyle(.plain)
  }

  private func shareCard(_ share: CanisterrShare) -> some View {
    HStack(alignment: .top, spacing: 14) {
      CanisterrPosterView(content: share.content, height: 146)
        .frame(width: 110)
      VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 10) {
          CanisterrAvatarView(name: share.sender.name, avatarURL: share.sender.avatarURL, diameter: 32)
          VStack(alignment: .leading, spacing: 2) {
            Text(share.sender.name)
              .font(.system(size: 14, weight: .bold, design: .rounded))
              .foregroundStyle(CanisterrTheme.text)
            Text("@\(share.sender.username)")
              .font(.system(size: 11, weight: .medium, design: .rounded))
              .foregroundStyle(CanisterrTheme.muted)
          }
          Spacer()
          CanisterrBadge(text: share.watched ? "Seen" : "New", tint: share.watched ? CanisterrTheme.success : CanisterrTheme.warning)
        }
        Text(share.note ?? "No note left.")
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
          .lineLimit(3)
        HStack(spacing: 8) {
          ForEach(share.content.genres.prefix(3), id: \.self) { genre in
            Text(genre)
              .font(.system(size: 10, weight: .bold, design: .rounded))
              .foregroundStyle(CanisterrTheme.muted)
              .padding(.horizontal, 8)
              .padding(.vertical, 5)
              .background(Capsule().fill(Color.white.opacity(0.04)))
          }
        }
        Spacer(minLength: 0)
      }
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

  private func activityCard(_ activity: CanisterrFriendActivity) -> some View {
    HStack(alignment: .top, spacing: 14) {
      CanisterrAvatarView(name: activity.user.name, avatarURL: activity.user.avatarURL, diameter: 34)
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text(activity.user.name)
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundStyle(CanisterrTheme.text)
          Text("logged")
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundStyle(CanisterrTheme.muted)
          Spacer()
          CanisterrBadge(text: activity.reaction.label, tint: reactionTint(activity.reaction))
        }
        Text(activity.content.title)
          .font(.system(size: 15, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        Text(activity.note ?? "No notes added.")
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
          .lineLimit(2)
      }
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

  private func roadmapCard(phase: CanisterrPhase, title: String, bullets: [String]) -> some View {
    HStack(alignment: .top, spacing: 14) {
      VStack(spacing: 8) {
        Image(systemName: phase == .phase1 ? "1.circle.fill" : "2.circle.fill")
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(phase == .phase1 ? CanisterrTheme.accent : CanisterrTheme.success)
        Rectangle()
          .fill(CanisterrTheme.border)
          .frame(width: 1, height: 40)
      }
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text(title)
            .font(.system(size: 16, weight: .black, design: .rounded))
            .foregroundStyle(CanisterrTheme.text)
          Spacer()
          CanisterrBadge(text: phase.rawValue, tint: phase == .phase1 ? CanisterrTheme.accent : CanisterrTheme.success)
        }
        VStack(alignment: .leading, spacing: 6) {
          ForEach(bullets, id: \.self) { bullet in
            HStack(alignment: .top, spacing: 8) {
              Circle()
                .fill(CanisterrTheme.accentSoft)
                .frame(width: 6, height: 6)
                .padding(.top, 6)
              Text(bullet)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(CanisterrTheme.muted)
            }
          }
        }
      }
    }
    .padding(16)
    .background(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .fill(CanisterrTheme.surfaceElevated)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(CanisterrTheme.border, lineWidth: 1)
    )
  }

  private func reactionTint(_ reaction: WatchReaction) -> Color {
    switch reaction {
    case .bad: return CanisterrTheme.danger
    case .good: return CanisterrTheme.success
    case .average: return CanisterrTheme.warning
    case .masterpiece: return CanisterrTheme.accent
    }
  }
}

