import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  DESKTOP_MODE_GAME_ID,
  MEDIA_PORT,
  SIGNALING_PORT,
  decodeSignalingMessage,
  encodeSignalingMessage,
  type RemoteGameSummary,
  type RemoteQualitySettings,
} from "./signalingProtocol";
import pkg from "../package.json";
import { useAuth } from "./AuthContext";
import { registerDevice } from "./authClient";
import { getOrCreateDeviceId } from "./deviceId";

const APP_VERSION = pkg.version;

interface InstalledGame {
  id: string;
  title: string;
}

type ConnState = "starting" | "listening" | "active" | "relay-error";

const HEARTBEAT_INTERVAL_MS = 30_000;
const PUBLIC_HOST_STORAGE_KEY = "alavex-public-host";

/** One native UDP session per client (DXGI/NVENC or ScreenCaptureKit/VideoToolbox). */
interface ClientSession {
  kind: "native";
}

function resolutionToDimensions(resolution: RemoteQualitySettings["resolution"] | undefined): {
  width: number;
  height: number;
} {
  switch (resolution) {
    case "720p":
      return { width: 1280, height: 720 };
    case "1440p":
      return { width: 2560, height: 1440 };
    case "4k":
      return { width: 3840, height: 2160 };
    case "1080p":
    default:
      return { width: 1920, height: 1080 };
  }
}

export function App() {
  const { user, token, logout } = useAuth();
  const [pin, setPin] = useState<string | null>(null);
  const [games, setGames] = useState<InstalledGame[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnState>("starting");
  const [clientCount, setClientCount] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [mediaStats, setMediaStats] = useState<{
    streaming: boolean;
    viewers: number;
    framesSent: number;
    audioSent: number;
    backend: string;
    hostAudio: boolean;
  } | null>(null);
  const [ffmpegSetup, setFfmpegSetup] = useState<
    | { status: "downloading"; percent: number }
    | { status: "extracting" }
    | { status: "ready"; path: string }
    | { status: "error"; message: string }
    | null
  >(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [hostPlatform, setHostPlatform] = useState("other");
  const [publicHost, setPublicHost] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(PUBLIC_HOST_STORAGE_KEY) ?? "" : ""
  );

  const wsRef = useRef<WebSocket | null>(null);
  const sessionsRef = useRef<Map<string, ClientSession>>(new Map());
  const gamesRef = useRef<InstalledGame[]>([]);
  useEffect(() => {
    gamesRef.current = games;
  }, [games]);
  const pinRef = useRef<string | null>(null);
  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  const publicHostRef = useRef(publicHost);
  useEffect(() => {
    publicHostRef.current = publicHost;
  }, [publicHost]);

  useEffect(() => {
    void invoke<{ localIp: string | null }>("get_device_info").then((info) => {
      setLocalIp(info.localIp);
    });
    void invoke<string>("host_platform").then(setHostPlatform).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const sendHeartbeat = async () => {
      try {
        const [deviceId, info] = await Promise.all([
          getOrCreateDeviceId(),
          invoke<{ name: string; macAddress: string | null; localIp: string | null; signalPort: number }>(
            "get_device_info"
          ),
        ]);
        if (cancelled) return;
        await registerDevice(token, {
          id: deviceId,
          name: info.name,
          macAddress: info.macAddress,
          lastIp: info.localIp,
          publicHost: publicHostRef.current.trim() || null,
          signalPort: info.signalPort,
          pairingPin: pinRef.current,
        });
      } catch {
        // Best-effort heartbeat.
      }
    };

    void sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token]);

  const loadGames = useCallback(() => {
    invoke<InstalledGame[]>("get_installed_games")
      .then((list) => {
        setGames(list);
        setGamesError(null);
      })
      .catch(() => {
        setGames([]);
        setGamesError("Steam 라이브러리를 찾지 못했습니다. Steam이 설치되어 있는지 확인해주세요.");
      });
  }, []);

  const refreshOverallState = useCallback(() => {
    const count = sessionsRef.current.size;
    setClientCount(count);
    setConnState((prev) => (prev === "relay-error" ? prev : count > 0 ? "active" : "listening"));
  }, []);

  const stopClientSession = useCallback(
    (clientId: string) => {
      const session = sessionsRef.current.get(clientId);
      if (!session) return;
      sessionsRef.current.delete(clientId);

      if (sessionsRef.current.size === 0) {
        void invoke("stop_native_stream").catch(() => undefined);
      }
      refreshOverallState();
    },
    [refreshOverallState]
  );

  const stopAllStreaming = useCallback(() => {
    sessionsRef.current.clear();
    void invoke("stop_native_stream").catch(() => undefined);
    refreshOverallState();
  }, [refreshOverallState]);

  const startNativeStreaming = useCallback(
    async (
      ws: WebSocket,
      clientId: string,
      gamesForClient: RemoteGameSummary[],
      gameId: string | null | undefined,
      quality: RemoteQualitySettings | undefined
    ) => {
      setStreamError(null);
      try {
        if (gameId && gameId !== DESKTOP_MODE_GAME_ID) {
          void invoke("launch_game", { gameId }).catch(() => undefined);
        }
        if (quality?.streamStartAction === "bigPicture") {
          void invoke("launch_big_picture").catch(() => undefined);
        } else if (quality?.streamStartAction === "custom" && quality.customProgramPath) {
          void invoke("launch_custom_program", { path: quality.customProgramPath }).catch(() => undefined);
        }

        const { width, height } = resolutionToDimensions(quality?.resolution);
        const backend = await invoke<string>("start_native_stream", {
          width,
          height,
          fps: quality?.fps ?? 120,
          bitrateMbps: quality?.bitrateMbps ?? 35,
          hostAudio: quality?.hostAudio ?? true,
        });
        sessionsRef.current.set(clientId, { kind: "native" });
        refreshOverallState();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            encodeSignalingMessage({
              type: "stream-ready",
              mediaPort: MEDIA_PORT,
              captureBackend:
                backend === "nvenc" || backend === "videotoolbox" ? backend : "software",
              clientId,
            })
          );
          ws.send(encodeSignalingMessage({ type: "games", games: gamesForClient, clientId }));
        }
      } catch (err) {
        setStreamError(
          err instanceof Error
            ? `네이티브 캡처 실패: ${err.message}`
            : "네이티브 캡처를 시작할 수 없습니다. ffmpeg 준비가 끝났는지 잠시 후 다시 시도해주세요."
        );
        stopClientSession(clientId);
      }
    },
    [refreshOverallState, stopClientSession]
  );

  useEffect(() => {
    invoke<string>("get_pin").then(setPin).catch(() => setPin(null));
    loadGames();
    let unlisten: (() => void) | undefined;
    void listen("alavex-pin-rotated", () => {
      void invoke<string>("get_pin").then(setPin).catch(() => undefined);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [loadGames]);

  // ffmpeg is prepared automatically in the background (see
  // `ffmpeg_setup.rs`) — no PATH setup required. This just surfaces
  // progress/errors so a first-run download doesn't look like a freeze.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<
      | { status: "downloading"; percent: number }
      | { status: "extracting" }
      | { status: "ready"; path: string }
      | { status: "error"; message: string }
    >("alavex-ffmpeg-setup", (event) => {
      setFfmpegSetup(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const retryFfmpegSetup = useCallback(() => {
    setFfmpegSetup({ status: "downloading", percent: 0 });
    void invoke("setup_ffmpeg").catch(() => undefined);
  }, []);

  useEffect(() => {
    const tick = () => {
      void invoke<{
        streaming: boolean;
        viewers: number;
        framesSent: number;
        audioSent: number;
        backend: string;
        hostAudio: boolean;
      } | null>("media_stats")
        .then(setMediaStats)
        .catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const port = SIGNALING_PORT;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/signal?role=host`);
    wsRef.current = ws;

    ws.onopen = () => setConnState("listening");
    ws.onerror = () => setConnState("relay-error");
    ws.onclose = () => setConnState("relay-error");

    ws.onmessage = (event) => {
      const msg = decodeSignalingMessage(String(event.data));
      if (!msg) return;

      switch (msg.type) {
        case "client-connected": {
          const clientId = msg.clientId;
          if (!clientId) break;
          const gamesToSend = gamesRef.current.map((g) => ({ id: g.id, title: g.title }));
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(encodeSignalingMessage({ type: "games", games: gamesToSend, clientId }));
          }
          break;
        }
        case "start-stream": {
          const clientId = msg.clientId;
          if (!clientId) break;
          const gamesForClient: RemoteGameSummary[] = gamesRef.current.map((g) => ({
            id: g.id,
            title: g.title,
          }));
          void startNativeStreaming(ws, clientId, gamesForClient, msg.gameId, msg.quality);
          break;
        }
        case "input": {
          if (msg.event) {
            void invoke("inject_input", { event: msg.event }).catch(() => undefined);
          }
          break;
        }
        case "gamepad": {
          void invoke("inject_gamepad", { index: msg.index, gamepad: msg.state }).catch(
            () => undefined
          );
          break;
        }
        case "peer-left": {
          if (msg.clientId) {
            stopClientSession(msg.clientId);
          } else {
            stopAllStreaming();
          }
          break;
        }
        default:
          break;
      }
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegeneratePin = async () => {
    setIsRegenerating(true);
    try {
      const newPin = await invoke<string>("regenerate_pin");
      setPin(newPin);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleLaunch = (gameId: string) => {
    void invoke("launch_game", { gameId }).catch(() => undefined);
  };

  const handleLaunchBigPicture = () => {
    void invoke("launch_big_picture").catch(() => undefined);
  };

  const platformLabel = hostPlatform === "macos" ? "macOS" : hostPlatform === "windows" ? "Windows" : "Host";
  const engineLabel =
    hostPlatform === "macos" ? "ScreenCaptureKit + VideoToolbox" : "DXGI + NVENC";

  return (
    <div className="min-h-screen bg-base-950 text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-base-700 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-brand-600 text-sm font-semibold tracking-tight text-white">
            A
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-brand-400">AlaveX</p>
            <h1 className="text-base font-semibold leading-none text-white">Host · {platformLabel}</h1>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[12rem] truncate text-xs text-slate-400 sm:block">{user.email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="border border-base-600 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-brand-500 hover:text-white"
            >
              로그아웃
            </button>
          </div>
        )}
      </header>

      {ffmpegSetup && ffmpegSetup.status !== "ready" && (
        <section className="border-b border-brand-500/40 bg-brand-500/10 px-5 py-3 text-sm">
          {ffmpegSetup.status === "downloading" && (
            <p className="text-slate-200">ffmpeg 준비 중 {ffmpegSetup.percent}% — 최초 한 번만 받습니다.</p>
          )}
          {ffmpegSetup.status === "extracting" && <p className="text-slate-200">ffmpeg 압축을 푸는 중...</p>}
          {ffmpegSetup.status === "error" && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-danger-400">ffmpeg 준비 실패: {ffmpegSetup.message}</p>
              <button
                type="button"
                onClick={retryFfmpegSetup}
                className="shrink-0 border border-base-600 px-3 py-1.5 text-xs text-slate-200 hover:border-brand-500"
              >
                다시 시도
              </button>
            </div>
          )}
        </section>
      )}

      {hostPlatform === "macos" && (
        <section className="border-b border-base-700 bg-base-900 px-5 py-3 text-xs leading-relaxed text-slate-400">
          macOS에서는 시스템 설정의 <span className="text-slate-200">화면 기록</span>과{" "}
          <span className="text-slate-200">손쉬운 사용</span>에 AlaveX Host를 허용해야 화면 전송과 입력이
          동작합니다. 허용 후 앱을 한 번 다시 여세요. ffmpeg는 Homebrew(`brew install ffmpeg`)로 준비합니다.
        </section>
      )}

      <div className="grid lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.15fr)]">
        <section className="border-b border-base-700 px-5 py-8 lg:border-b-0 lg:border-r">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">페어링 PIN</p>
          <p className="mt-3 font-mono text-6xl font-medium tracking-[0.28em] text-brand-300">
            {pin ?? "----"}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            스트리밍 앱에 이 기기의 IP와 PIN을 입력하세요. PIN은 주소가 아니라 연결 메시지 본문으로만
            갑니다. 영상은 시청자 한 명만 받습니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegeneratePin}
              disabled={isRegenerating}
              className="bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {isRegenerating ? "재발급 중..." : "PIN 재발급"}
            </button>
            <button
              type="button"
              onClick={handleLaunchBigPicture}
              className="border border-base-600 px-4 py-2 text-sm text-slate-200 hover:border-brand-500"
            >
              Steam 빅픽처
            </button>
          </div>
          <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-slate-500">세션</p>
          <p className="mt-2 text-sm text-slate-100">{connStateLabel(connState, clientCount, engineLabel)}</p>
          {clientCount > 0 && (
            <p className="mt-1 text-xs text-brand-300">연결된 클라이언트 {clientCount}</p>
          )}
          {streamError && <p className="mt-2 text-sm text-danger-400">{streamError}</p>}
          {clientCount > 0 && (
            <button
              type="button"
              onClick={stopAllStreaming}
              className="mt-4 border border-danger-500/50 px-4 py-2 text-sm text-danger-400 hover:bg-danger-500/10"
            >
              스트리밍 중지
            </button>
          )}
        </section>

        <section className="border-b border-base-700 px-5 py-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">경로</p>
          <dl className="mt-4 divide-y divide-base-700 border-y border-base-700 text-sm">
            <Row label="LAN IP" value={localIp ?? "확인 중..."} />
            <Row label="시그널링" value={`TCP ${SIGNALING_PORT}`} />
            <Row label="미디어" value={`UDP ${MEDIA_PORT}`} />
            <Row label="엔진" value={engineLabel} />
            <Row label="인코더" value={mediaStats?.backend ?? "대기"} />
            <Row label="UDP 시청자" value={String(mediaStats?.viewers ?? 0)} />
            <Row label="프레임" value={String(mediaStats?.framesSent ?? 0)} />
            <Row
              label="오디오"
              value={mediaStats?.hostAudio ? `${mediaStats.audioSent} pkt` : "끔"}
            />
          </dl>
          <label htmlFor="public-host" className="mt-5 block text-[11px] uppercase tracking-[0.18em] text-slate-500">
            공인 IP 또는 DDNS
          </label>
          <input
            id="public-host"
            value={publicHost}
            onChange={(e) => {
              const value = e.target.value;
              setPublicHost(value);
              window.localStorage.setItem(PUBLIC_HOST_STORAGE_KEY, value);
            }}
            placeholder="203.0.113.10 또는 mypc.example.com"
            className="mt-2 w-full border border-base-600 bg-base-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500"
          />
          <p className="mt-2 text-xs leading-relaxed text-warn-400">
            시그널링은 암호화되지 않은 ws:// 입니다. 포트를 인터넷에 열기 전에 위험을 확인하세요.
            {hostPlatform === "windows" ? " Windows 방화벽 인바운드도 허용해야 합니다." : " macOS 방화벽이 켜져 있으면 수신을 허용하세요."}
          </p>
        </section>
      </div>

      <section className="px-5 py-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Steam 라이브러리 · {games.length}
          </p>
          <button type="button" onClick={loadGames} className="text-xs text-brand-400 hover:text-brand-300">
            새로고침
          </button>
        </div>
        {gamesError ? (
          <p className="text-sm text-slate-400">{gamesError}</p>
        ) : games.length === 0 ? (
          <p className="text-sm text-slate-500">설치된 게임을 찾지 못했습니다.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-base-700 overflow-y-auto border-y border-base-700">
            {games.map((game) => (
              <li key={game.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="truncate text-slate-100">{game.title}</span>
                <button
                  type="button"
                  onClick={() => handleLaunch(game.id)}
                  className="shrink-0 border border-base-600 px-2 py-1 text-xs text-slate-300 hover:border-brand-500 hover:text-white"
                >
                  실행
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-base-800 px-5 py-4 text-xs leading-relaxed text-slate-500">
        <p>
          창을 닫아도 메뉴 막대(또는 트레이)에서 계속 연결을 받습니다. 완전히 끄려면 메뉴의 종료를
          선택하세요. v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-mono text-slate-100">{value}</dd>
    </div>
  );
}

function connStateLabel(state: ConnState, clientCount: number, engineLabel: string): string {
  switch (state) {
    case "starting":
      return "시작하는 중";
    case "listening":
      return "대기 중 — 클라이언트 연결을 기다리고 있습니다";
    case "active":
      return clientCount > 1
        ? `${clientCount}개 클라이언트에 ${engineLabel}로 스트리밍 중`
        : `${engineLabel}로 스트리밍 중`;
    case "relay-error":
      return "시그널링 서버에 연결할 수 없습니다. 앱을 다시 열어주세요.";
    default:
      return "";
  }
}
