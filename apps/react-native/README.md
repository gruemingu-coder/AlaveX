# AlaveX React Native client

Android와 Windows 스트리밍 클라이언트입니다. Mac과 iPhone은 SwiftUI (`apps/apple`)입니다.

로그인, 클라우드 PC 목록, PIN 시그널링 테스트까지 이 앱에서 동작합니다. LLU2 영상 디코드는 아직 포함되어 있지 않습니다.

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
