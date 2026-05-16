import SwiftUI

struct CanisterrLogsView: View {
  @EnvironmentObject private var store: CanisterrStore
  var composeMode: Bool = false
  @State private var reaction: WatchReaction? = .good
  @State private var notes: String = ""
  @State private var selectedContent: CanisterrContent?

  init(composeMode: Bool = false) {
    self.composeMode = composeMode
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        CanisterrSectionHeader(
          title: "Logs",
          subtitle: "Phase 2: watched movies, reactions, and notes."
        ) {
          if composeMode {
            Button("Save") {
              if let selectedContent {
                Task { await store.logContent(selectedContent, reaction: reaction, notes: notes) }
              }
            }
            .buttonStyle(CanisterrPrimaryButtonStyle())
          } else {
            Button {
              store.selectedSection = .share
            } label: {
              Image(systemName: "plus")
            }
            .buttonStyle(CanisterrPrimaryButtonStyle())
          }
        }

        if composeMode {
          composerPanel
        }

        if store.snapshot.logs.isEmpty {
          CanisterrEmptyStateView(
            title: "No logs yet",
            subtitle: "When Phase 2 lands, watched titles will show up here.",
            symbol: "film.stack"
          )
        } else {
          VStack(spacing: 12) {
            ForEach(store.snapshot.logs) { log in
              logCard(log)
            }
          }
        }
      }
      .padding(.vertical, 8)
    }
    .onAppear {
      if selectedContent == nil {
        selectedContent = store.snapshot.dashboard.featuredContent.first
      }
    }
  }

  private var composerPanel: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Quick log")
        .font(.system(size: 13, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      Picker("Reaction", selection: Binding(
        get: { reaction ?? .good },
        set: { reaction = $0 }
      )) {
        ForEach(WatchReaction.allCases) { item in
          Text(item.label).tag(item)
        }
      }
      .pickerStyle(.segmented)
      .tint(CanisterrTheme.accent)

      TextField("Notes", text: $notes, axis: .vertical)
        .lineLimit(4...8)
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .foregroundStyle(CanisterrTheme.text)
        .background(
          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(CanisterrTheme.surfaceElevated)
        )
        .overlay(
          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(CanisterrTheme.border, lineWidth: 1)
        )

      if let selectedContent {
        HStack(spacing: 12) {
          CanisterrPosterView(content: selectedContent, height: 100)
            .frame(width: 74)
          VStack(alignment: .leading, spacing: 6) {
            Text(selectedContent.title)
              .font(.system(size: 15, weight: .black, design: .rounded))
              .foregroundStyle(CanisterrTheme.text)
            Text(selectedContent.overview)
              .font(.system(size: 12, weight: .medium, design: .rounded))
              .foregroundStyle(CanisterrTheme.muted)
              .lineLimit(3)
          }
        }
        .padding(12)
        .background(
          RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(CanisterrTheme.surface)
        )
      } else {
        Button("Select a title") {
          store.selectedSection = .share
        }
        .buttonStyle(CanisterrSecondaryButtonStyle())
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

  private func logCard(_ log: CanisterrWatchLog) -> some View {
    HStack(alignment: .top, spacing: 14) {
      CanisterrPosterView(content: log.content, height: 132)
        .frame(width: 96)
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text(log.user.name)
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundStyle(CanisterrTheme.text)
          Spacer()
          if let reaction = log.reaction {
            CanisterrBadge(text: reaction.label, tint: reactionTint(reaction))
          }
        }
        Text(log.content.title)
          .font(.system(size: 16, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        Text(log.notes)
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
          .lineLimit(3)
        Text(log.watchedAt, style: .relative)
          .font(.system(size: 11, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.subtle)
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

  private func reactionTint(_ reaction: WatchReaction) -> Color {
    switch reaction {
    case .bad: return CanisterrTheme.danger
    case .good: return CanisterrTheme.success
    case .average: return CanisterrTheme.warning
    case .masterpiece: return CanisterrTheme.accent
    }
  }
}
