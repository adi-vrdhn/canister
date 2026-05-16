import SwiftUI

#if canImport(FirebaseCore)
import FirebaseCore
#endif

@main
struct CanisterrApp: App {
  @StateObject private var store = CanisterrStore()

  init() {
    #if canImport(FirebaseCore)
    if FirebaseApp.app() == nil {
      FirebaseApp.configure()
    }
    #endif
  }

  var body: some Scene {
    WindowGroup {
      CanisterrRootView()
        .environmentObject(store)
    }
  }
}

