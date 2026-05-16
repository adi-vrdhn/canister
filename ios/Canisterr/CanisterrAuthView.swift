import SwiftUI

struct CanisterrAuthView: View {
  @EnvironmentObject private var store: CanisterrStore
  @State private var showPassword = false

  var body: some View {
    GeometryReader { proxy in
      ScrollView {
        VStack(spacing: 18) {
          if proxy.size.width >= 900 {
            HStack(spacing: 0) {
              heroPanel
              formPanel
            }
            .frame(minHeight: max(proxy.size.height - 48, 720))
          } else {
            VStack(spacing: 0) {
              heroPanel
              formPanel
            }
          }
        }
        .padding(24)
      }
    }
  }

  private var heroPanel: some View {
    VStack(alignment: .leading, spacing: 18) {
      CanisterrBadge(text: "Native rebuild", tint: CanisterrTheme.accentSoft)
      Spacer(minLength: 0)

      VStack(alignment: .leading, spacing: 12) {
        Text("Canisterr")
          .font(.system(size: 46, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        Text("A cinematic social movie app, rebuilt for SwiftUI without losing the web layout.")
          .font(.system(size: 16, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
          .lineSpacing(4)
      }

      HStack(spacing: 12) {
        CanisterrMetricTile(value: "Phase 1", label: "Auth, dashboard, share, friends", icon: "1.circle.fill")
        CanisterrMetricTile(value: "Phase 2", label: "Lists, logs, notifications, settings", icon: "2.circle.fill")
      }

      VStack(alignment: .leading, spacing: 10) {
        Text("What ships first")
          .font(.system(size: 13, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        ForEach([
          "Login and sign-up",
          "Dashboard feed and quick actions",
          "Movie sharing",
          "Friends and follow requests",
          "Profile and account shell"
        ], id: \.self) { item in
          HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
              .foregroundStyle(CanisterrTheme.success)
            Text(item)
              .font(.system(size: 13, weight: .medium, design: .rounded))
              .foregroundStyle(CanisterrTheme.text)
            Spacer()
          }
        }
      }
      .padding(18)
      .background(
        RoundedRectangle(cornerRadius: 24, style: .continuous)
          .fill(CanisterrTheme.surfaceElevated)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 24, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(28)
    .background(
      RoundedRectangle(cornerRadius: 32, style: .continuous)
        .fill(
          LinearGradient(
            colors: [
              Color(red: 0.05, green: 0.05, blue: 0.05),
              Color(red: 0.09, green: 0.07, blue: 0.05)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
    )
    .overlay(
      RoundedRectangle(cornerRadius: 32, style: .continuous)
        .stroke(CanisterrTheme.border, lineWidth: 1)
    )
  }

  private var formPanel: some View {
    VStack(alignment: .leading, spacing: 18) {
      VStack(alignment: .leading, spacing: 8) {
        Text(store.authMode.rawValue)
          .font(.system(size: 26, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        Text("Use the same account that powers the web app.")
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
      }

      Picker("", selection: $store.authMode) {
        ForEach(AuthMode.allCases) { mode in
          Text(mode.rawValue).tag(mode)
        }
      }
      .pickerStyle(.segmented)
      .tint(CanisterrTheme.accent)

      VStack(spacing: 14) {
        if store.authMode == .signUp {
          inputField(title: "Name", text: $store.authName, systemImage: "person.fill")
          inputField(title: "Username", text: $store.authUsername, systemImage: "at")
        }
        inputField(title: "Email", text: $store.authEmail, systemImage: "envelope.fill")
        passwordField
      }

      Button {
        Task { await store.submitAuthentication() }
      } label: {
        HStack {
          Text(store.authMode.rawValue)
          Spacer()
          Image(systemName: "arrow.right")
        }
      }
      .buttonStyle(CanisterrPrimaryButtonStyle())

      VStack(alignment: .leading, spacing: 10) {
        Text("Production notes")
          .font(.system(size: 12, weight: .black, design: .rounded))
          .foregroundStyle(CanisterrTheme.text)
        Text("This scaffold is wired to a mock backend first so you can ship the layout safely. Firebase and TMDB can be plugged in without changing the UI shell.")
          .font(.system(size: 12, weight: .medium, design: .rounded))
          .foregroundStyle(CanisterrTheme.muted)
          .lineSpacing(3)
      }
      .padding(16)
      .background(
        RoundedRectangle(cornerRadius: 22, style: .continuous)
          .fill(CanisterrTheme.surfaceElevated)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 22, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity)
    .padding(28)
    .background(
      RoundedRectangle(cornerRadius: 32, style: .continuous)
        .fill(CanisterrTheme.surface)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 32, style: .continuous)
        .stroke(CanisterrTheme.border, lineWidth: 1)
    )
  }

  private func inputField(title: String, text: Binding<String>, systemImage: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title)
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .foregroundStyle(CanisterrTheme.muted)
      HStack(spacing: 10) {
        Image(systemName: systemImage)
          .foregroundStyle(CanisterrTheme.subtle)
        TextField(title, text: text)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .foregroundStyle(CanisterrTheme.text)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 14)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color.white.opacity(0.04))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )
    }
  }

  private var passwordField: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Password")
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .foregroundStyle(CanisterrTheme.muted)
      HStack(spacing: 10) {
        Image(systemName: "lock.fill")
          .foregroundStyle(CanisterrTheme.subtle)
        if showPassword {
          TextField("Password", text: $store.authPassword)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .foregroundStyle(CanisterrTheme.text)
        } else {
          SecureField("Password", text: $store.authPassword)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .foregroundStyle(CanisterrTheme.text)
        }
        Button {
          showPassword.toggle()
        } label: {
          Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
            .foregroundStyle(CanisterrTheme.subtle)
        }
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 14)
      .background(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(Color.white.opacity(0.04))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(CanisterrTheme.border, lineWidth: 1)
      )
    }
  }
}

