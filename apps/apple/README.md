# AlaveX SwiftUI client

Mac과 iPhone(iPad) 스트리밍 클라이언트입니다. Android와 Windows는 React Native (`apps/react-native`)입니다.

iPhone과 Mac에서 로그인 후 PIN으로 바로 플레이합니다. 영상은 VideoToolbox H.264, 소리는 AAC, 터치와 게임패드는 호스트로 전달됩니다. 목표 프레임은 120 FPS입니다. App Store 파일이 없어서 iPhone에는 Xcode로 설치합니다.

요구 사항: Xcode 15+, macOS 13+, iOS 16+.

## Mac에서 바로 실행

```bash
cd apps/apple
swift run AlaveXStreaming
```

## Xcode (Mac 앱 + iPhone 시뮬레이터)

```bash
brew install xcodegen
cd apps/apple
xcodegen generate
open AlaveX.xcodeproj
```

- 스킴 `AlaveX-macOS`: Mac 앱
- 스킴 `AlaveX-iOS`: iPhone / iPad

시그널링이 `ws://` 이므로 앱 Info.plist에서 로컬/일반 HTTP를 허용합니다.
