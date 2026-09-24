# AlaveX native client protocol (shared)

Native streaming clients use SwiftUI on Mac and iPhone (`apps/apple`) and React Native on Android and Windows (`apps/react-native`). Android plays LLU2 in `PlayerActivity` (MediaCodec + AAC + touch/gamepad). They follow the same wire protocol as `src/services/streaming/signalingProtocol.ts`.

## Ports (Sunshine-compatible)

| Constant | Value | Protocol | Use |
| --- | --- | --- | --- |
| `SIGNALING_PORT` | 47989 | TCP | WebSocket `ws://{host}:{port}/signal?role=client` |
| `MEDIA_PORT` | 47998 | UDP | LLU2 H.264/audio |
| `DISCOVERY_PORT` | 47999 | UDP | LAN broadcast discovery (optional) |

Router forwarding (same as Sunshine): TCP 47984–47990, UDP 47998–48010.

## Signaling flow

1. Connect WebSocket to host
2. Send `{ "type": "auth", "pin": "1234", "clientName": "AlaveX" }`
3. Receive `auth-ok` with `mediaToken`, `mediaPort`, `hostName`, `macAddress`
4. Send `start-stream` with optional `gameId` and `quality`
5. Receive `stream-ready`
6. Open UDP to `mediaPort` with `mediaToken` (LLU2 — see `src-tauri/src/media_client.rs`)
7. Forward input as `{ "type": "input", ... }` on WebSocket

## Account API

Base URL: `https://alavex.pages.dev/api`

- `POST /auth/login` — `{ email, password }` → `{ token, user }`
- `POST /auth/signup`
- `GET /auth/me` — Bearer token
- `GET /devices` — cloud-synced host PCs
- `POST /devices` — host heartbeat (Host app only)

## Host app

The host stays in `host-app/` (Rust). Windows captures with DXGI, macOS with ScreenCaptureKit. Not part of this `apps/` tree.
