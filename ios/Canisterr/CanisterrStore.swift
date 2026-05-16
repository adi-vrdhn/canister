import Combine
import Foundation

@MainActor
final class CanisterrStore: ObservableObject {
  @Published var session: CanisterrSessionState = .loading
  @Published var selectedSection: CanisterrSection = .dashboard
  @Published var snapshot = CanisterrAppSnapshot(
    user: nil,
    dashboard: CanisterrSamples.dashboard,
    lists: [],
    logs: [],
    notifications: [],
    following: [],
    followers: [],
    pendingRequests: []
  )
  @Published var searchQuery: String = ""
  @Published var searchFilter: CanisterrContentFilter = .all
  @Published var searchResults: [CanisterrContent] = []
  @Published var recipientQuery: String = ""
  @Published var recipientResults: [CanisterrUser] = []
  @Published var composerSelection = CanisterrComposerSelection()
  @Published var authEmail: String = ""
  @Published var authPassword: String = ""
  @Published var authName: String = ""
  @Published var authUsername: String = ""
  @Published var authMode: AuthMode = .signIn
  @Published var isBusy = false
  @Published var bannerMessage: String?

  let backend: any CanisterrBackendClient

  init(backend: (any CanisterrBackendClient)? = nil) {
    self.backend = backend ?? CanisterrBackendFactory.makeDefault()
  }

  var currentUser: CanisterrUser? {
    snapshot.user
  }

  var unreadNotificationCount: Int {
    snapshot.notifications.filter { !$0.isRead }.count
  }

  func bootstrap() async {
    isBusy = true
    defer { isBusy = false }
    do {
      let freshSnapshot = try await backend.bootstrap()
      snapshot = freshSnapshot
      session = freshSnapshot.user.map { .signedIn($0) } ?? .signedOut
      if freshSnapshot.user == nil {
        selectedSection = .dashboard
      }
    } catch {
      session = .signedOut
      bannerMessage = error.localizedDescription
    }
  }

  func submitAuthentication() async {
    isBusy = true
    defer { isBusy = false }

    do {
      let user: CanisterrUser
      switch authMode {
      case .signIn:
        user = try await backend.signIn(email: authEmail, password: authPassword)
      case .signUp:
        user = try await backend.signUp(
          name: authName,
          username: authUsername,
          email: authEmail,
          password: authPassword
        )
      }
      snapshot.user = user
      session = .signedIn(user)
      selectedSection = .dashboard
      bannerMessage = authMode == .signIn ? "Welcome back." : "Account created."
      await bootstrap()
    } catch {
      bannerMessage = error.localizedDescription
    }
  }

  func signOut() async {
    isBusy = true
    defer { isBusy = false }
    do {
      try await backend.signOut()
      session = .signedOut
      snapshot.user = nil
      selectedSection = .dashboard
    } catch {
      bannerMessage = error.localizedDescription
    }
  }

  func runContentSearch() async {
    let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else {
      searchResults = []
      return
    }
    do {
      searchResults = try await backend.searchContent(query: query, filter: searchFilter)
    } catch {
      searchResults = []
      bannerMessage = error.localizedDescription
    }
  }

  func runRecipientSearch() async {
    let query = recipientQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    if query.isEmpty {
      recipientResults = snapshot.following + snapshot.followers
      return
    }
    do {
      recipientResults = try await backend.searchUsers(query: query)
    } catch {
      recipientResults = []
      bannerMessage = error.localizedDescription
    }
  }

  func toggleRecipient(_ user: CanisterrUser) {
    if composerSelection.recipientIDs.contains(user.id) {
      composerSelection.recipientIDs.remove(user.id)
    } else {
      composerSelection.recipientIDs.insert(user.id)
    }
  }

  func sendShare() async {
    guard let content = composerSelection.content else {
      bannerMessage = "Pick a movie or show first."
      return
    }
    let recipients = allKnownRecipients.filter { composerSelection.recipientIDs.contains($0.id) }
    guard !recipients.isEmpty else {
      bannerMessage = "Choose at least one person."
      return
    }
    isBusy = true
    defer { isBusy = false }
    do {
      try await backend.sendShare(content: content, recipients: recipients, note: composerSelection.note.isEmpty ? nil : composerSelection.note)
      composerSelection = CanisterrComposerSelection()
      bannerMessage = "Shared successfully."
      await bootstrap()
    } catch {
      bannerMessage = error.localizedDescription
    }
  }

  func createList(name: String, description: String?, privacy: ListPrivacy, ranked: Bool) async {
    isBusy = true
    defer { isBusy = false }
    do {
      _ = try await backend.createList(name: name, description: description, privacy: privacy, ranked: ranked)
      bannerMessage = "List created."
      await bootstrap()
    } catch {
      bannerMessage = error.localizedDescription
    }
  }

  func logContent(_ content: CanisterrContent, reaction: WatchReaction?, notes: String) async {
    isBusy = true
    defer { isBusy = false }
    do {
      _ = try await backend.logContent(content, reaction: reaction, notes: notes)
      bannerMessage = "Logged."
      await bootstrap()
    } catch {
      bannerMessage = error.localizedDescription
    }
  }

  func follow(_ user: CanisterrUser) async {
    isBusy = true
    defer { isBusy = false }
    do {
      try await backend.createFollowRequest(to: user)
      bannerMessage = "Follow request sent."
      await bootstrap()
    } catch {
      bannerMessage = error.localizedDescription
    }
  }

  func acceptFollow(_ user: CanisterrUser) async {
    isBusy = true
    defer { isBusy = false }
    do {
      try await backend.acceptFollowRequest(from: user)
      bannerMessage = "Request accepted."
      await bootstrap()
    } catch {
      bannerMessage = error.localizedDescription
    }
  }

  var allKnownRecipients: [CanisterrUser] {
    let unique = snapshot.following + snapshot.followers + snapshot.pendingRequests
    var seen = Set<String>()
    return unique.filter { seen.insert($0.id).inserted }
  }
}

enum CanisterrSessionState: Hashable {
  case loading
  case signedOut
  case signedIn(CanisterrUser)
}

enum AuthMode: String, CaseIterable, Identifiable {
  case signIn = "Sign in"
  case signUp = "Create account"

  var id: String { rawValue }
}
