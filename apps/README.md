# AlaveX native streaming clients

호스트(`host-app/`)는 Tauri + Rust 그대로입니다. 플레이하는 쪽 UI만 플랫폼별로 나눕니다.

| 기기 | UI | 경로 |
| --- | --- | --- |
| Mac, iPhone, iPad | SwiftUI | `apps/apple/` |
| Android, Windows | React Native | `apps/react-native/` |
| Windows / macOS 호스트 | Rust + DXGI 또는 ScreenCaptureKit | `host-app/` |

`apps/android/` 의 Kotlin Compose 프로젝트는 더 이상 클라이언트 경로가 아닙니다.

SwiftUI와 React Native 앱은 계정 로그인, 클라우드 PC 목록, PIN 시그널링 테스트까지 구현되어 있습니다. LLU2 영상 디코드는 아직 `src-tauri/` 스트리밍 셸에만 있습니다.

공유 프로토콜: `apps/shared/protocol.md`, `apps/shared/constants.json`.

웹사이트와 계정 API는 저장소 루트(`src/`, `worker/`)입니다.

## 빌드

### Mac / iPhone (SwiftUI)

```bash
cd apps/apple
swift run AlaveXStreaming
```

iPhone 시뮬레이터는 Xcode가 필요합니다.

```bash
brew install xcodegen
cd apps/apple
xcodegen generate
open AlaveX.xcodeproj
```

Xcode 15+, macOS 13+, iOS 16+.

### Android (React Native)

```bash
cd apps/react-native
npm install
npm run android
```

Android Studio, JDK 17, Android SDK 35. APK: `npm run android:apk`.

### Windows (React Native)

```bash
cd apps/react-native
npm install
npx react-native-windows-init --overwrite
npm run windows
```

Visual Studio 2022 C++ 데스크톱 워크로드, Windows 10/11.

### 호스트

```bash
cd host-app
npm install
npm run tauri:build          # Windows MSI
npm run tauri:mac:build      # macOS DMG. Rust(rustup)와 ffmpeg 필요
```
