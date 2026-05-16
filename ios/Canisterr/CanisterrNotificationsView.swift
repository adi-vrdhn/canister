import SwiftUI

struct CanisterrNotificationsView: View {
  @EnvironmentObject private var store: CanisterrStore

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        CanisterrSectionHeader(title: "Notifications", subtitle: "Phase 2: requests, shares, replies, and reminders.")
        if store.snapshot.notifications.isEmpty {
          CanisterrEmptyStateView(
            title: "No notifications",
            subtitle: "The alert center will fill as social activity picks up.",
            symbol: "bell"
          )
        } else {
          VStack(spacing: 12) {
            ForEach(store.snapshot.notifications) { notification in
              HStack(alignment: .top, spacing: 14) {
                Image(systemName: notification.icon)
                  .font(.system(size: 16, weight: .bold))
                  .foregroundStyle(notification.isRead ? CanisterrTheme.subtle : CanisterrTheme.accentSoft)
                  .padding(12)
                  .background(
                    Circle()
                      .fill(notification.isRead ? Color.white.opacity(0.03) : CanisterrTheme.accent.opacity(0.12))
                  )
                VStack(alignment: .leading, spacing: 6) {
                  HStack {
                    Text(notification.title)
                      .font(.system(size: 15, weight: .black, design: .rounded))
                      .foregroundStyle(CanisterrTheme.text)
                    Spacer()
                    if !notification.isRead {
                      CanisterrBadge(text: "New", tint: CanisterrTheme.warning)
                    }
                  }
                  Text(notification.body)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(CanisterrTheme.muted)
                    .lineLimit(3)
                  Text(notification.createdAt, style: .relative)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(CanisterrTheme.subtle)
                }
              }
              .padding(14)
              .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                  .fill(notification.isRead ? CanisterrTheme.surface : CanisterrTheme.surfaceElevated)
              )
              .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                  .stroke(CanisterrTheme.border, lineWidth: 1)
              )
            }
          }
        }
      }
      .padding(.vertical, 8)
    }
  }
}

