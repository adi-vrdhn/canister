# Capacitor Android Setup

This repo is configured for a Capacitor Android shell.

## What it does

- The Android app loads the URL from `CAPACITOR_SERVER_URL` when that env var is set.
- If no URL is set, Capacitor still syncs using the placeholder web shell in `capacitor-web/`.

## Build flow

1. Set your deployed Canisterr URL:

```bash
export CAPACITOR_SERVER_URL="https://your-render-app.onrender.com"
```

2. Sync the Android project:

```bash
npm run cap:sync
```

3. Open Android Studio:

```bash
npm run cap:open
```

4. Build an APK in Android Studio:

- `Build > Build Bundle(s) / APK(s) > Build APK(s)`

## Debug APK path

The debug APK is usually written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Side-load to a phone

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
