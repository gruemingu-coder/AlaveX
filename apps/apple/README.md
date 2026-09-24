# AlaveX SwiftUI client

Mac과 iPhone(iPad) 스트리밍 클라이언트입니다. Android와 Windows는 React Native (`apps/react-native`)입니다.

로그인, 클라우드 PC 목록, PIN 시그널링 테스트까지 동작합니다. LLU2 영상 디코드는 아직 없습니다.

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
