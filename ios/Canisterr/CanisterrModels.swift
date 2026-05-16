import Foundation

enum CanisterrPhase: String, CaseIterable, Identifiable, Hashable {
  case phase1 = "Phase 1"
  case phase2 = "Phase 2"

  var id: String { rawValue }

  var subtitle: String {
    switch self {
    case .phase1:
      return "Core social movie flow"
    case .phase2:
      return "Power features and retention"
    }
  }
}

enum CanisterrSection: String, CaseIterable, Identifiable, Hashable {
  case dashboard
  case share
  case friends
  case lists
  case logs
  case notifications
  case settings

  var id: String { rawValue }

  var title: String {
    switch self {
    case .dashboard: return "Dashboard"
    case .share: return "Share"
    case .friends: return "Friends"
    case .lists: return "Lists"
    case .logs: return "Logs"
    case .notifications: return "Notifications"
    case .settings: return "Settings"
    }
  }

  var phase: CanisterrPhase {
    switch self {
    case .dashboard, .share, .friends:
      return .phase1
    case .lists, .logs, .notifications, .settings:
      return .phase2
    }
  }

  var symbol: String {
    switch self {
    case .dashboard: return "house.fill"
    case .share: return "arrowshape.turn.up.right.fill"
    case .friends: return "person.2.fill"
    case .lists: return "rectangle.stack.fill"
    case .logs: return "film.stack.fill"
    case .notifications: return "bell.fill"
    case .settings: return "gearshape.fill"
    }
  }
}

enum CanisterrContentType: String, CaseIterable, Codable, Hashable {
  case movie
  case tv

  var label: String {
    switch self {
    case .movie: return "Movie"
    case .tv: return "TV"
    }
  }
}

enum CanisterrContentFilter: String, CaseIterable, Identifiable, Hashable {
  case all
  case movie
  case tv
  case accounts

  var id: String { rawValue }

  var title: String {
    switch self {
    case .all: return "All"
    case .movie: return "Movies"
    case .tv: return "TV"
    case .accounts: return "People"
    }
  }
}

enum ListPrivacy: String, Codable, Hashable {
  case privateList = "private"
  case publicList = "public"

  var label: String { rawValue.capitalized }
}

enum WatchReaction: String, CaseIterable, Identifiable, Hashable {
  case bad
  case good
  case average
  case masterpiece

  var id: String { rawValue }

  var label: String {
    switch self {
    case .bad: return "Bad"
    case .good: return "Good"
    case .average: return "Average"
    case .masterpiece: return "Masterpiece"
    }
  }

  var symbol: String {
    switch self {
    case .bad: return "hand.thumbsdown.fill"
    case .good: return "hand.thumbsup.fill"
    case .average: return "circle.lefthalf.filled"
    case .masterpiece: return "sparkles"
    }
  }
}

struct CanisterrUser: Identifiable, Hashable {
  let id: String
  let username: String
  let name: String
  let avatarURL: URL?
  let bio: String?
  let isVerified: Bool
  let followersCount: Int
  let followingCount: Int

  var initial: String {
    name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1).uppercased()
  }
}

struct CanisterrContent: Identifiable, Hashable {
  let remoteID: Int
  let contentType: CanisterrContentType
  let title: String
  let subtitle: String
  let posterURL: URL?
  let backdropURL: URL?
  let genres: [String]
  let releaseYear: String
  let runtime: String
  let rating: Double
  let overview: String

  var id: String { "\(contentType.rawValue)-\(remoteID)" }
}

struct CanisterrShare: Identifiable, Hashable {
  let id: String
  let sender: CanisterrUser
  let receiver: CanisterrUser
  let content: CanisterrContent
  let note: String?
  let watched: Bool
  let createdAt: Date
}

struct CanisterrFriendActivity: Identifiable, Hashable {
  let id: String
  let user: CanisterrUser
  let content: CanisterrContent
  let reaction: WatchReaction
  let note: String?
  let watchedAt: Date
}

struct CanisterrFollow: Identifiable, Hashable {
  let id: String
  let follower: CanisterrUser
  let following: CanisterrUser
  let status: String
  let createdAt: Date
}

struct CanisterrList: Identifiable, Hashable {
  let id: String
  let name: String
  let description: String?
  let ownerName: String
  let privacy: ListPrivacy
  let isRanked: Bool
  let itemCount: Int
  let collaboratorCount: Int
  let coverURLs: [URL]
  let updatedAt: Date
}

struct CanisterrWatchLog: Identifiable, Hashable {
  let id: String
  let user: CanisterrUser
  let content: CanisterrContent
  let reaction: WatchReaction?
  let notes: String
  let watchedAt: Date
}

struct CanisterrNotification: Identifiable, Hashable {
  let id: String
  let title: String
  let body: String
  let icon: String
  let isRead: Bool
  let createdAt: Date
}

struct CanisterrDashboardSnapshot: Hashable {
  var incomingShares: [CanisterrShare]
  var friendActivity: [CanisterrFriendActivity]
  var featuredContent: [CanisterrContent]
}

struct CanisterrAppSnapshot: Hashable {
  var user: CanisterrUser?
  var dashboard: CanisterrDashboardSnapshot
  var lists: [CanisterrList]
  var logs: [CanisterrWatchLog]
  var notifications: [CanisterrNotification]
  var following: [CanisterrUser]
  var followers: [CanisterrUser]
  var pendingRequests: [CanisterrUser]
}

struct CanisterrComposerSelection: Hashable {
  var content: CanisterrContent?
  var recipientIDs: Set<String> = []
  var note: String = ""
}
