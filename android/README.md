# Canisterr Android

Native Kotlin + Jetpack Compose starter for the Canisterr app.

## What’s included

- Home feed
- Movie detail screen
- Discover grid
- Logs feed
- Profile screen
- Repository-backed app content state
- Loading and error shells for the app bootstrap

## Open in Android Studio

1. Open the `android/` folder as a project.
2. Make sure you have:
   - JDK 17
   - Android SDK 36
3. Sync Gradle.
4. You can also run it from the terminal with `./gradlew installDebug` once the SDK is installed.

## Tech stack

- Kotlin
- Jetpack Compose
- Material 3
- Repository abstraction for future Firebase or TMDB integration

## Production next steps

- Replace `DemoAppContentRepository` with a real remote repository.
- Add Firebase auth and a signed-in user state.
- Wire network images, caching, and offline persistence.
- Add app icons, signing config, analytics, and crash reporting.
- Add tests for state, navigation, and repository behavior.
