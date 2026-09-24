/**
 * Wire protocol between the AlaveX streaming (client) app and the
 * AlaveX host app, relayed through the host's local WebSocket
 * signaling server (see `host-app/src-tauri/src/signaling.rs`).
 *
 * Native path (preferred):
 *  - Client sends `start-stream` after `auth-ok`
 *  - Host starts DXGI+NVENC capture and replies `stream-ready`
 *  - Client opens UDP media port (default 47998, LLU2) via Tauri bridge
 *  - Input rides the signaling WebSocket as `input` messages
 *
 * Port numbers match Sunshine defaults (base 47989) so the same router
 * port-forward rules work: TCP 47984–47990, UDP 47998–48010.
 */

/** Sunshine HTTP/base port — AlaveX WebSocket signaling (TCP). */
export const SIGNALING_PORT = 47989;
/** Sunshine video stream port — LLU2 H.264/audio (UDP). */
export const MEDIA_PORT = 47998;
/** Sunshine audio port — LAN discovery broadcast (UDP, LAN only). */
export const DISCOVERY_PORT = 47999;

export interface IceCandidateInit {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface RemoteGameSummary {
  id: string;
  title: string;
}

export const DESKTOP_MODE_GAME_ID = "desktop";

export interface RemoteQualitySettings {
  resolution: "720p" | "1080p" | "1440p" | "4k";
  fps: number;
  bitrateMbps: number;
  codec: "h264" | "h265" | "av1";
  hostAudio: boolean;
  streamStartAction: "bigPicture" | "desktop" | "custom";
  customProgramPath?: string;
  latencyMode: "quality" | "balanced" | "latency";
}

export interface AuthMessage {
  type: "auth";
  pin: string;
  clientName: string;
}

export interface AuthOkMessage {
  type: "auth-ok";
  hostName: string;
  macAddress?: string | null;
  mediaPort?: number;
  captureBackend?: "nvenc" | "videotoolbox" | "software";
  /** Short-lived UDP media credential (prefer over PIN on the wire). */
  mediaToken?: string | null;
  protocol?: string;
}

export interface AuthFailMessage {
  type: "auth-fail";
  reason: string;
}

export interface StartStreamMessage {
  type: "start-stream";
  gameId?: string | null;
  quality?: RemoteQualitySettings;
}

export interface StreamReadyMessage {
  type: "stream-ready";
  mediaPort: number;
  captureBackend: "nvenc" | "videotoolbox" | "software";
}

export interface InputMessage {
  type: "input";
  event: import("./StreamingEngine").InputForwardEvent;
}

/**
 * Standard Gamepad API snapshot (17 buttons / 4 axes), forwarded as-is —
 * the host maps it onto a virtual XInput controller via ViGEmBus, so any
 * controller the client's browser normalizes to the "standard" mapping
 * (Xbox One/Series, DualSense, DualShock 4, ...) works transparently.
 */
export interface GamepadStateWire {
  connected: boolean;
  buttons: number[];
  axes: number[];
}

export interface GamepadMessage {
  type: "gamepad";
  /** Client-local gamepad slot (0-3), supports multiple controllers. */
  index: number;
  state: GamepadStateWire;
}

export interface OfferMessage {
  type: "offer";
  sdp: string;
  gameId?: string | null;
  quality?: RemoteQualitySettings;
}

export interface AnswerMessage {
  type: "answer";
  sdp: string;
}

export interface IceMessage {
  type: "ice";
  candidate: IceCandidateInit;
}

export interface GamesMessage {
  type: "games";
  games: RemoteGameSummary[];
}

export interface ByeMessage {
  type: "bye";
}

export interface PeerLeftMessage {
  type: "peer-left";
}

export type SignalingMessage =
  | AuthMessage
  | AuthOkMessage
  | AuthFailMessage
  | StartStreamMessage
  | StreamReadyMessage
  | InputMessage
  | GamepadMessage
  | OfferMessage
  | AnswerMessage
  | IceMessage
  | GamesMessage
  | ByeMessage
  | PeerLeftMessage;

export function encodeSignalingMessage(message: SignalingMessage): string {
  return JSON.stringify(message);
}

export function decodeSignalingMessage(raw: string): SignalingMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.type === "string") {
      return parsed as SignalingMessage;
    }
    return null;
  } catch {
    return null;
  }
}

export type DataChannelMessage =
  | { kind: "input"; event: import("./StreamingEngine").InputForwardEvent }
  | { kind: "ping"; t: number }
  | { kind: "pong"; t: number };
