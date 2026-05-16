import Foundation

protocol CanisterrBackendClient {
  func bootstrap() async throws -> CanisterrAppSnapshot
  func signIn(email: String, password: String) async throws -> CanisterrUser
  func signUp(name: String, username: String, email: String, password: String) async throws -> CanisterrUser
  func signOut() async throws
  func searchContent(query: String, filter: CanisterrContentFilter) async throws -> [CanisterrContent]
  func searchUsers(query: String) async throws -> [CanisterrUser]
  func sendShare(content: CanisterrContent, recipients: [CanisterrUser], note: String?) async throws
  func createFollowRequest(to user: CanisterrUser) async throws
  func acceptFollowRequest(from user: CanisterrUser) async throws
  func createList(name: String, description: String?, privacy: ListPrivacy, ranked: Bool) async throws -> CanisterrList
  func logContent(_ content: CanisterrContent, reaction: WatchReaction?, notes: String) async throws -> CanisterrWatchLog
}

enum CanisterrBackendError: LocalizedError {
  case notImplemented
  case emptySession
  case invalidQuery

  var errorDescription: String? {
    switch self {
    case .notImplemented:
      return "This backend action has not been wired yet."
    case .emptySession:
      return "No active Canisterr session exists."
    case .invalidQuery:
      return "Enter a search query first."
    }
  }
}

final class MockCanisterrBackendClient: CanisterrBackendClient {
  private var currentUser: CanisterrUser?
  private var catalog: [CanisterrContent]
  private var users: [CanisterrUser]
  private var shares: [CanisterrShare]
  private var lists: [CanisterrList]
  private var logs: [CanisterrWatchLog]
  private var notifications: [CanisterrNotification]
  private var following: [CanisterrUser]
  private var followers: [CanisterrUser]
  private var pendingRequests: [CanisterrUser]
  private var dashboard: CanisterrDashboardSnapshot

  init() {
    let user = CanisterrSamples.user
    let friend = CanisterrSamples.friend
    let creator = CanisterrSamples.creator

    currentUser = nil
    users = [user, friend, creator, CanisterrSamples.critic]
    catalog = CanisterrSamples.catalog
    shares = CanisterrSamples.shares
    lists = CanisterrSamples.lists
    logs = CanisterrSamples.logs
    notifications = CanisterrSamples.notifications
    following = [friend, creator]
    followers = [friend]
    pendingRequests = [CanisterrSamples.critic]
    dashboard = CanisterrSamples.dashboard
  }

  func bootstrap() async throws -> CanisterrAppSnapshot {
    CanisterrAppSnapshot(
      user: currentUser,
      dashboard: dashboard,
      lists: lists,
      logs: logs,
      notifications: notifications,
      following: following,
      followers: followers,
      pendingRequests: pendingRequests
    )
  }

  func signIn(email: String, password: String) async throws -> CanisterrUser {
    let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !normalizedEmail.isEmpty, !password.isEmpty else { throw CanisterrBackendError.emptySession }
    currentUser = CanisterrSamples.user
    return CanisterrSamples.user
  }

  func signUp(name: String, username: String, email: String, password: String) async throws -> CanisterrUser {
    let newUser = CanisterrUser(
      id: UUID().uuidString,
      username: username.lowercased(),
      name: name,
      avatarURL: nil,
      bio: "New to Canisterr.",
      isVerified: false,
      followersCount: 0,
      followingCount: 0
    )
    currentUser = newUser
    users.append(newUser)
    return newUser
  }

  func signOut() async throws {
    currentUser = nil
  }

  func searchContent(query: String, filter: CanisterrContentFilter) async throws -> [CanisterrContent] {
    let cleaned = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleaned.isEmpty else { throw CanisterrBackendError.invalidQuery }

    return catalog.filter { content in
      let matchesQuery = content.title.localizedCaseInsensitiveContains(cleaned) ||
        content.subtitle.localizedCaseInsensitiveContains(cleaned) ||
        content.genres.joined(separator: " ").localizedCaseInsensitiveContains(cleaned)

      let matchesFilter: Bool = {
        switch filter {
        case .all: return true
        case .movie: return content.contentType == .movie
        case .tv: return content.contentType == .tv
        case .accounts: return false
        }
      }()

      return matchesQuery && matchesFilter
    }
  }

  func searchUsers(query: String) async throws -> [CanisterrUser] {
    let cleaned = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleaned.isEmpty else { return users }
    return users.filter {
      $0.name.localizedCaseInsensitiveContains(cleaned) ||
      $0.username.localizedCaseInsensitiveContains(cleaned)
    }
  }

  func sendShare(content: CanisterrContent, recipients: [CanisterrUser], note: String?) async throws {
    guard let currentUser else { throw CanisterrBackendError.emptySession }
    for recipient in recipients {
      shares.insert(
        CanisterrShare(
          id: UUID().uuidString,
          sender: currentUser,
          receiver: recipient,
          content: content,
          note: note,
          watched: false,
          createdAt: .now
        ),
        at: 0
      )
    }
  }

  func createFollowRequest(to user: CanisterrUser) async throws {
    guard let currentUser else { throw CanisterrBackendError.emptySession }
    pendingRequests.insert(user, at: 0)
    notifications.insert(
      CanisterrNotification(
        id: UUID().uuidString,
        title: "Follow request sent",
        body: "You asked @\(user.username) to connect.",
        icon: "person.badge.plus",
        isRead: false,
        createdAt: .now
      ),
      at: 0
    )
    _ = currentUser
  }

  func acceptFollowRequest(from user: CanisterrUser) async throws {
    pendingRequests.removeAll { $0.id == user.id }
    following.insert(user, at: 0)
  }

  func createList(name: String, description: String?, privacy: ListPrivacy, ranked: Bool) async throws -> CanisterrList {
    let list = CanisterrList(
      id: UUID().uuidString,
      name: name,
      description: description,
      ownerName: currentUser?.name ?? "You",
      privacy: privacy,
      isRanked: ranked,
      itemCount: 0,
      collaboratorCount: 1,
      coverURLs: [],
      updatedAt: .now
    )
    lists.insert(list, at: 0)
    return list
  }

  func logContent(_ content: CanisterrContent, reaction: WatchReaction?, notes: String) async throws -> CanisterrWatchLog {
    guard let currentUser else { throw CanisterrBackendError.emptySession }
    let log = CanisterrWatchLog(
      id: UUID().uuidString,
      user: currentUser,
      content: content,
      reaction: reaction,
      notes: notes,
      watchedAt: .now
    )
    logs.insert(log, at: 0)
    return log
  }
}

#if canImport(FirebaseCore) && canImport(FirebaseAuth)
import FirebaseAuth
import FirebaseCore

final class FirebaseCanisterrBackendClient: CanisterrBackendClient {
  func bootstrap() async throws -> CanisterrAppSnapshot {
    guard let firebaseUser = Auth.auth().currentUser else {
      return CanisterrAppSnapshot(
        user: nil,
        dashboard: CanisterrSamples.dashboard,
        lists: [],
        logs: [],
        notifications: [],
        following: [],
        followers: [],
        pendingRequests: []
      )
    }

    let user = CanisterrUser(
      id: firebaseUser.uid,
      username: firebaseUser.email?.components(separatedBy: "@").first?.lowercased() ?? "user",
      name: firebaseUser.displayName ?? firebaseUser.email ?? "Canisterr User",
      avatarURL: firebaseUser.photoURL,
      bio: nil,
      isVerified: false,
      followersCount: 0,
      followingCount: 0
    )

    return CanisterrAppSnapshot(
      user: user,
      dashboard: CanisterrSamples.dashboard,
      lists: [],
      logs: [],
      notifications: [],
      following: [],
      followers: [],
      pendingRequests: []
    )
  }

  func signIn(email: String, password: String) async throws -> CanisterrUser {
    let credential = try await Auth.auth().signIn(withEmail: email, password: password)
    return CanisterrUser(
      id: credential.user.uid,
      username: credential.user.email?.components(separatedBy: "@").first?.lowercased() ?? "user",
      name: credential.user.displayName ?? credential.user.email ?? "Canisterr User",
      avatarURL: credential.user.photoURL,
      bio: nil,
      isVerified: false,
      followersCount: 0,
      followingCount: 0
    )
  }

  func signUp(name: String, username: String, email: String, password: String) async throws -> CanisterrUser {
    let credential = try await Auth.auth().createUser(withEmail: email, password: password)
    try await credential.user.sendEmailVerification()
    return CanisterrUser(
      id: credential.user.uid,
      username: username.lowercased(),
      name: name,
      avatarURL: credential.user.photoURL,
      bio: nil,
      isVerified: false,
      followersCount: 0,
      followingCount: 0
    )
  }

  func signOut() async throws {
    try Auth.auth().signOut()
  }

  func searchContent(query: String, filter: CanisterrContentFilter) async throws -> [CanisterrContent] {
    _ = filter
    return []
  }

  func searchUsers(query: String) async throws -> [CanisterrUser] {
    _ = query
    return []
  }

  func sendShare(content: CanisterrContent, recipients: [CanisterrUser], note: String?) async throws {
    _ = content
    _ = recipients
    _ = note
    throw CanisterrBackendError.notImplemented
  }

  func createFollowRequest(to user: CanisterrUser) async throws {
    _ = user
    throw CanisterrBackendError.notImplemented
  }

  func acceptFollowRequest(from user: CanisterrUser) async throws {
    _ = user
    throw CanisterrBackendError.notImplemented
  }

  func createList(name: String, description: String?, privacy: ListPrivacy, ranked: Bool) async throws -> CanisterrList {
    _ = (name, description, privacy, ranked)
    throw CanisterrBackendError.notImplemented
  }

  func logContent(_ content: CanisterrContent, reaction: WatchReaction?, notes: String) async throws -> CanisterrWatchLog {
    _ = (content, reaction, notes)
    throw CanisterrBackendError.notImplemented
  }
}
#endif

enum CanisterrBackendFactory {
  static func makeDefault() -> any CanisterrBackendClient {
    #if canImport(FirebaseCore) && canImport(FirebaseAuth)
    if FirebaseApp.app() != nil {
      return FirebaseCanisterrBackendClient()
    }
    #endif
    return MockCanisterrBackendClient()
  }
}

enum CanisterrSamples {
  static let user = CanisterrUser(
    id: "user-juno",
    username: "juno",
    name: "Juno Carter",
    avatarURL: nil,
    bio: "Log movies. Share the good ones.",
    isVerified: true,
    followersCount: 142,
    followingCount: 87
  )

  static let friend = CanisterrUser(
    id: "user-iris",
    username: "iris",
    name: "Iris Stone",
    avatarURL: nil,
    bio: "Too many thrillers, not enough sleep.",
    isVerified: false,
    followersCount: 61,
    followingCount: 114
  )

  static let creator = CanisterrUser(
    id: "user-milo",
    username: "milo",
    name: "Milo Reed",
    avatarURL: nil,
    bio: "Lists over everything.",
    isVerified: false,
    followersCount: 98,
    followingCount: 133
  )

  static let critic = CanisterrUser(
    id: "user-sage",
    username: "sage",
    name: "Sage Harper",
    avatarURL: nil,
    bio: "Long-form notes and careful ratings.",
    isVerified: true,
    followersCount: 315,
    followingCount: 201
  )

  static let catalog: [CanisterrContent] = [
    CanisterrContent(
      remoteID: 1,
      contentType: .movie,
      title: "La La Land",
      subtitle: "Movie",
      posterURL: nil,
      backdropURL: nil,
      genres: ["Music", "Romance", "Drama"],
      releaseYear: "2016",
      runtime: "128 min",
      rating: 8.0,
      overview: "A modern musical about ambition, love, and the cost of chasing a dream."
    ),
    CanisterrContent(
      remoteID: 2,
      contentType: .movie,
      title: "Arrival",
      subtitle: "Movie",
      posterURL: nil,
      backdropURL: nil,
      genres: ["Sci-Fi", "Drama"],
      releaseYear: "2016",
      runtime: "116 min",
      rating: 7.9,
      overview: "A linguist works to communicate with mysterious visitors who arrive on Earth."
    ),
    CanisterrContent(
      remoteID: 3,
      contentType: .tv,
      title: "The Bear",
      subtitle: "TV Series",
      posterURL: nil,
      backdropURL: nil,
      genres: ["Drama", "Comedy"],
      releaseYear: "2022",
      runtime: "35 min",
      rating: 8.6,
      overview: "A chef returns home to run a sandwich shop while trying to save what matters."
    ),
    CanisterrContent(
      remoteID: 4,
      contentType: .tv,
      title: "Shogun",
      subtitle: "TV Series",
      posterURL: nil,
      backdropURL: nil,
      genres: ["Drama", "History"],
      releaseYear: "2024",
      runtime: "55 min",
      rating: 8.9,
      overview: "A political drama set in feudal Japan, with alliances that can break at any moment."
    )
  ]

  static let shares: [CanisterrShare] = [
    CanisterrShare(
      id: "share-1",
      sender: friend,
      receiver: user,
      content: catalog[0],
      note: "This feels like your kind of heartbreak.",
      watched: false,
      createdAt: .now.addingTimeInterval(-9_200)
    ),
    CanisterrShare(
      id: "share-2",
      sender: creator,
      receiver: user,
      content: catalog[2],
      note: "You should absolutely catch up on this.",
      watched: true,
      createdAt: .now.addingTimeInterval(-23_500)
    )
  ]

  static let logs: [CanisterrWatchLog] = [
    CanisterrWatchLog(
      id: "log-1",
      user: friend,
      content: catalog[0],
      reaction: .masterpiece,
      notes: "The ending still hits.",
      watchedAt: .now.addingTimeInterval(-3_400)
    ),
    CanisterrWatchLog(
      id: "log-2",
      user: creator,
      content: catalog[1],
      reaction: .good,
      notes: "The pacing is the whole trick.",
      watchedAt: .now.addingTimeInterval(-7_200)
    )
  ]

  static let lists: [CanisterrList] = [
    CanisterrList(
      id: "list-1",
      name: "Late Night Rewatches",
      description: "Movies that feel better after midnight.",
      ownerName: user.name,
      privacy: .privateList,
      isRanked: false,
      itemCount: 12,
      collaboratorCount: 2,
      coverURLs: [],
      updatedAt: .now.addingTimeInterval(-4_500)
    ),
    CanisterrList(
      id: "list-2",
      name: "Friends Can Vote",
      description: "A ranked list built together.",
      ownerName: creator.name,
      privacy: .publicList,
      isRanked: true,
      itemCount: 24,
      collaboratorCount: 4,
      coverURLs: [],
      updatedAt: .now.addingTimeInterval(-9_800)
    )
  ]

  static let notifications: [CanisterrNotification] = [
    CanisterrNotification(
      id: "notif-1",
      title: "New share from Iris",
      body: "Iris sent you Arrival with a note.",
      icon: "arrowshape.turn.up.right.fill",
      isRead: false,
      createdAt: .now.addingTimeInterval(-1_800)
    ),
    CanisterrNotification(
      id: "notif-2",
      title: "Follow request",
      body: "Sage wants to connect with you.",
      icon: "person.badge.plus.fill",
      isRead: true,
      createdAt: .now.addingTimeInterval(-13_400)
    )
  ]

  static let dashboard = CanisterrDashboardSnapshot(
    incomingShares: shares,
    friendActivity: logs.map {
      CanisterrFriendActivity(
        id: $0.id,
        user: $0.user,
        content: $0.content,
        reaction: $0.reaction ?? .good,
        note: $0.notes,
        watchedAt: $0.watchedAt
      )
    },
    featuredContent: catalog
  )
}
