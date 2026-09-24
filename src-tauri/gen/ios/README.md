# iPhone client

iPhone과 iPad 스트리밍 UI는 SwiftUI입니다. `apps/apple` 를 여세요.

```bash
cd apps/apple
brew install xcodegen
xcodegen generate
open AlaveX.xcodeproj
# 스킴 AlaveX-iOS
```

Mac 앱도 같은 패키지입니다 (`swift run AlaveXStreaming` 또는 스킴 `AlaveX-macOS`).

`npm run tauri:ios:*` 는 영상 디코드가 들어 있는 이전 Tauri 셸입니다. 새 iPhone UI는 SwiftUI 쪽입니다.
