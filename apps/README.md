# AlaveX native streaming clients

Tauri (`src-tauri/`) is being replaced by platform-native UI stacks:

| Platform | Stack | Path |
| --- | --- | --- |
| macOS + iOS | SwiftUI | `apps/apple/` |
| Android | Kotlin + Jetpack Compose | `apps/android/` |
| Windows (streaming) | React Native + RN Windows | `apps/windows/` |
| Windows / macOS (host) | Rust + DXGI or ScreenCaptureKit | `host-app/` |

Shared protocol: `apps/shared/protocol.md` and `apps/shared/constants.json`.

Web site + account API remain in repo root (`src/`, `worker/`).

## Build

### Apple (SwiftUI)

```bash
cd apps/apple
swift build
# Xcode: open Package.swift as project, run AlaveXStreaming scheme (macOS or iOS simulator)
```

Requires Xcode 15+, macOS 12+ / iOS 15+.

### Android (Compose)

Open `apps/android` in **Android Studio** (recommended — it generates the Gradle wrapper), or:

```bash
cd apps/android
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

Requires Android Studio, JDK 17, Android SDK 26+.

### Windows (React Native)

```bash
cd apps/windows
npm install
# First time on Windows only — generates native C++ project:
npx react-native-windows-init --overwrite
npx react-native run-windows
```

Requires Visual Studio 2022 with C++ desktop workload, Windows 10/11.

The JS/TS layer (login, devices, signaling test) works cross-platform; native `windows/` folder is created on a Windows machine.

### Host (Windows MSI)

```powershell
cd host-app
npm install
npm run tauri:build
```

Windows uses DXGI/NVENC. macOS uses ScreenCaptureKit/VideoToolbox (`npm run tauri:mac:build` in `host-app`).
