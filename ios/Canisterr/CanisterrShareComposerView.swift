import SwiftUI

struct CanisterrShareComposerView: View {
  @EnvironmentObject private var store: CanisterrStore

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        CanisterrSectionHeader(
          title: "Share",
          subtitle: "Search a title, pick people, add a note, send."
        ) {
          Button("Done") {
            Task { await store.sendShare() }
          }
          .buttonStyle(CanisterrPrimaryButtonStyle())
        }

        searchPanel
        if let content = store.composerSelection.content {
          selectedContentCard(content)
        }
        recipientsPanel
        notePanel
      }
      .padding(.vertical, 8)
    }
    .task(id: store.searchQuery + store.searchFilter.rawValue) {
      await store.runContentSearch()
    }
    .task(id: store.recipientQuery) {
      await store.runRecipientSearch()
    }
  }

  private var searchPanel: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Search content")
        .font(.system(size: 13, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      HStack(spacing: 10) {
        Image(systemName: "magnifyingglass")
          .foregroundStyle(CanisterrTheme.subtle)
        TextField("Search movies or TV shows", text: $store.searchQuery)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .foregroundStyle(CanisterrTheme.text)
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

      Picker("Filter", selection: $store.searchFilter) {
        ForEach(CanisterrContentFilter.allCases) { filter in
          Text(filter.title).tag(filter)
        }
      }
      .pickerStyle(.segmented)
      .tint(CanisterrTheme.accent)

      if store.searchResults.isEmpty {
        CanisterrEmptyStateView(
          title: "Search anything",
          subtitle: "The same search-first share flow as the web app.",
          symbol: "play.circle"
        )
      } else {
        VStack(spacing: 12) {
          ForEach(store.searchResults) { content in
            Button {
              store.composerSelection.content = content
            } label: {
              HStack(spacing: 12) {
                CanisterrPosterView(content: content, height: 110)
                  .frame(width: 82)
                VStack(alignment: .leading, spacing: 6) {
                  HStack {
                    Text(content.title)
                      .font(.system(size: 15, weight: .black, design: .rounded))
                      .foregroundStyle(CanisterrTheme.text)
                    Spacer()
                    Text(content.contentType.label)
                      .font(.system(size: 10, weight: .black, design: .rounded))
                      .foregroundStyle(CanisterrTheme.accentSoft)
                  }
                  Text(content.overview)
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
              .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                  .stroke(store.composerSelection.content?.id == content.id ? CanisterrTheme.accent.opacity(0.5) : CanisterrTheme.border, lineWidth: 1)
              )
            }
            .buttonStyle(.plain)
          }
        }
      }
    }
  }

  private func selectedContentCard(_ content: CanisterrContent) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Selected")
        .font(.system(size: 13, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      HStack(spacing: 12) {
        CanisterrPosterView(content: content, height: 140)
          .frame(width: 100)
        VStack(alignment: .leading, spacing: 8) {
          Text(content.title)
            .font(.system(size: 16, weight: .black, design: .rounded))
            .foregroundStyle(CanisterrTheme.text)
          Text("\(content.releaseYear) • \(content.runtime)")
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(CanisterrTheme.muted)
          Text(content.genres.joined(separator: " • "))
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(CanisterrTheme.muted)
          Button("Clear selection") {
            store.composerSelection.content = nil
          }
          .buttonStyle(CanisterrSecondaryButtonStyle())
        }
      }
      .padding(14)
      .background(
        RoundedRectangle(cornerRadius: 24, style: .continuous)
          .fill(CanisterrTheme.surfaceElevated)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 24, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )
    }
  }

  private var recipientsPanel: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Recipients")
        .font(.system(size: 13, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)

      HStack(spacing: 10) {
        Image(systemName: "person.2")
          .foregroundStyle(CanisterrTheme.subtle)
        TextField("Search people", text: $store.recipientQuery)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .foregroundStyle(CanisterrTheme.text)
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

      if store.recipientResults.isEmpty {
        CanisterrEmptyStateView(
          title: "No recipients",
          subtitle: "Search your network to pick who this is for.",
          symbol: "person.crop.circle.badge.questionmark"
        )
      } else {
        VStack(spacing: 10) {
          ForEach(store.recipientResults) { user in
            Button {
              store.toggleRecipient(user)
            } label: {
              HStack(spacing: 12) {
                CanisterrAvatarView(name: user.name, avatarURL: user.avatarURL, diameter: 36)
                VStack(alignment: .leading, spacing: 4) {
                  Text(user.name)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(CanisterrTheme.text)
                  Text("@\(user.username)")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(CanisterrTheme.muted)
                }
                Spacer()
                Image(systemName: store.composerSelection.recipientIDs.contains(user.id) ? "checkmark.circle.fill" : "circle")
                  .foregroundStyle(store.composerSelection.recipientIDs.contains(user.id) ? CanisterrTheme.success : CanisterrTheme.subtle)
              }
              .padding(12)
              .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                  .fill(CanisterrTheme.surface)
              )
              .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                  .stroke(store.composerSelection.recipientIDs.contains(user.id) ? CanisterrTheme.success.opacity(0.35) : CanisterrTheme.border, lineWidth: 1)
              )
            }
            .buttonStyle(.plain)
          }
        }
      }
    }
  }

  private var notePanel: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Note")
        .font(.system(size: 13, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
      TextEditor(text: $store.composerSelection.note)
        .frame(minHeight: 110)
        .padding(10)
        .scrollContentBackground(.hidden)
        .foregroundStyle(CanisterrTheme.text)
        .background(
          RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(CanisterrTheme.surfaceElevated)
        )
        .overlay(
          RoundedRectangle(cornerRadius: 20, style: .continuous)
            .stroke(CanisterrTheme.border, lineWidth: 1)
        )

      Button {
        Task { await store.sendShare() }
      } label: {
        HStack {
          Text("Send share")
          Spacer()
          Image(systemName: "paperplane.fill")
        }
      }
      .buttonStyle(CanisterrPrimaryButtonStyle())
    }
  }
}

