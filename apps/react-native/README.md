# AlaveX React Native client

Android와 Windows 스트리밍 클라이언트입니다. Mac과 iPhone은 SwiftUI (`apps/apple`)입니다.

Android에서는 로그인 후 호스트 PIN으로 바로 플레이합니다. 영상은 MediaCodec H.264, 소리는 AAC, 터치와 게임패드는 호스트로 전달됩니다. Mac과 iPhone 클라이언트는 아직 시그널링만 합니다.

## Android

Android Studio (SDK 35, JDK 17) 또는 명령줄:

```bash
cd apps/react-native
npm install
npm run android
# 릴리스 APK
npm run android:apk
# app/build/outputs/apk/release/app-release.apk
```

패키지 이름: `org.alavex.streaming`. 시그널링이 `ws://` 이므로 cleartext를 허용합니다.

## Windows

```bash
cd apps/react-native
npm install
npx react-native-windows-init --overwrite
npm run windows
```

Visual Studio 2022 C++ 데스크톱 워크로드, Windows 10/11. `windows/` 네이티브 프로젝트는 Windows에서만 생성합니다.
