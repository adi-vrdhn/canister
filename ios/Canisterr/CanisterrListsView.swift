import SwiftUI

struct CanisterrListsView: View {
  @EnvironmentObject private var store: CanisterrStore
  @State private var showCreate = false
  @State private var listName = ""
  @State private var listDescription = ""
  @State private var privacy: ListPrivacy = .privateList
  @State private var ranked = false
  @State private var viewMode: ListsViewMode = .list

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        CanisterrSectionHeader(
          title: "Lists",
          subtitle: "Phase 2: the same list workflows, now native."
        ) {
          Button {
            showCreate = true
          } label: {
            Image(systemName: "plus")
          }
          .buttonStyle(CanisterrPrimaryButtonStyle())
        }

        Picker("View", selection: $viewMode) {
          ForEach(ListsViewMode.allCases) { mode in
            Text(mode.title).tag(mode)
          }
        }
        .pickerStyle(.segmented)
        .tint(CanisterrTheme.accent)

        ForEach(CanisterrPhase.allCases) { phase in
          VStack(alignment: .leading, spacing: 12) {
            HStack {
              CanisterrBadge(text: phase.rawValue, tint: phase == .phase1 ? CanisterrTheme.accent : CanisterrTheme.success)
              Text(phase.subtitle)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(CanisterrTheme.muted)
            }
            let lists = filteredLists(for: phase)
            if lists.isEmpty {
              CanisterrEmptyStateView(
                title: "No lists yet",
                subtitle: phase == .phase1 ? "Phase 1 keeps the focus on shares and friends." : "Start with a clean list shell in Phase 2.",
                symbol: "rectangle.stack"
              )
            } else {
              if viewMode == .grid {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                  ForEach(lists) { list in
                    listCard(list)
                  }
                }
              } else {
                VStack(spacing: 12) {
                  ForEach(lists) { list in
                    listRow(list)
                  }
                }
              }
            }
          }
        }
      }
      .padding(.vertical, 8)
    }
    .sheet(isPresented: $showCreate) {
      NavigationStack {
        Form {
          Section("Basics") {
            TextField("List name", text: $listName)
            TextField("Description", text: $listDescription, axis: .vertical)
          }
          Section("Style") {
            Picker("Privacy", selection: $privacy) {
              Text("Private").tag(ListPrivacy.privateList)
              Text("Public").tag(ListPrivacy.publicList)
            }
            Toggle("Ranked", isOn: $ranked)
          }
        }
        .navigationTitle("Create list")
        .toolbar {
          ToolbarItem(placement: .confirmationAction) {
            Button("Create") {
              Task {
                await store.createList(name: listName, description: listDescription.isEmpty ? nil : listDescription, privacy: privacy, ranked: ranked)
                listName = ""
                listDescription = ""
                privacy = .privateList
                ranked = false
                showCreate = false
              }
            }
          }
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") {
              showCreate = false
            }
          }
        }
      }
      .presentationDetents([.medium, .large])
    }
  }

  private func filteredLists(for phase: CanisterrPhase) -> [CanisterrList] {
    switch phase {
    case .phase1:
      return store.snapshot.lists.prefix(1).map { $0 }
    case .phase2:
      return store.snapshot.lists.dropFirst().map { $0 }
    }
  }

  private func listCard(_ list: CanisterrList) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        CanisterrBadge(text: list.privacy.label, tint: list.privacy == .publicList ? CanisterrTheme.success : CanisterrTheme.accent)
        Spacer()
        Image(systemName: list.isRanked ? "1.square.fill" : "square.grid.2x2.fill")
          .foregroundStyle(CanisterrTheme.subtle)
      }
      Text(list.name)
        .font(.system(size: 15, weight: .black, design: .rounded))
        .foregroundStyle(CanisterrTheme.text)
        .lineLimit(2)
      Text(list.description ?? "No description.")
        .font(.system(size: 12, weight: .medium, design: .rounded))
        .foregroundStyle(CanisterrTheme.muted)
        .lineLimit(3)
      HStack {
        Text("\(list.itemCount) items")
        Spacer()
        Text("\(list.collaboratorCount) people")
      }
      .font(.system(size: 11, weight: .medium, design: .rounded))
      .foregroundStyle(CanisterrTheme.subtle)
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

  private func listRow(_ list: CanisterrList) -> some View {
    HStack(spacing: 14) {
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(
          LinearGradient(
            colors: [CanisterrTheme.surfaceElevated, Color.black],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
        .frame(width: 72, height: 92)
        .overlay(
          Image(systemName: "rectangle.stack.fill")
            .foregroundStyle(CanisterrTheme.accentSoft)
        )
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text(list.name)
            .font(.system(size: 16, weight: .black, design: .rounded))
            .foregroundStyle(CanisterrTheme.text)
          Spacer()
          CanisterrBadge(text: list.privacy.label, tint: list.privacy == .publicList ? CanisterrTheme.success : CanisterrTheme.accent)
        }
        Text(list.description ?? "No description.")
          .font(.system(size: 12, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
          .lineLimit(2)
        HStack(spacing: 12) {
          Text("\(list.itemCount) items")
          Text("\(list.collaboratorCount) collaborators")
          Text(list.updatedAt, style: .relative)
        }
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
}

private enum ListsViewMode: String, CaseIterable, Identifiable {
  case list
  case grid

  var id: String { rawValue }

  var title: String {
    switch self {
    case .list: return "List"
    case .grid: return "Grid"
    }
  }
}
