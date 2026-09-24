import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/layout/Logo";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

/**
 * Host MSI + Streaming clients. Windows/macOS/Android installers are
 * published to `public/downloads/` by CI on tagged releases. iOS uses
 * TestFlight / IPA from Actions until App Store listing exists.
 */
const HOST_WIN_URL = "/downloads/AlaveX-Host-Setup.msi";
const HOST_MAC_URL = "/downloads/AlaveX-Host-macOS.dmg";
const STREAMING_WIN_URL = "/downloads/AlaveX-Streaming-Setup.msi";
const STREAMING_MAC_URL = "/downloads/AlaveX-Streaming-macOS.dmg";
const STREAMING_ANDROID_URL =
  "https://raw.githubusercontent.com/gruemingu-coder/lumalink/main/releases/AlaveX-Streaming.apk";

const HOSTS = [
  {
    key: "windows",
    name: "AlaveX Host · Windows",
    tagline: "게이밍 PC",
    format: "MSI",
    description:
      "DXGI로 화면을 캡처하고 NVIDIA NVENC(없으면 libx264)로 인코딩합니다. ffmpeg는 최초 실행 때 자동으로 준비되고, 컨트롤러는 ViGEmBus가 있으면 가상 Xbox로 전달됩니다.",
    url: HOST_WIN_URL,
    fileName: "AlaveX-Host-Setup.msi",
    missing: "Windows MSI가 아직 없습니다.",
  },
  {
    key: "macos",
    name: "AlaveX Host · macOS",
    tagline: "게이밍 Mac",
    format: "DMG",
    description:
      "ScreenCaptureKit으로 화면을 캡처하고 VideoToolbox(없으면 libx264)로 인코딩합니다. ffmpeg는 Homebrew로 설치하고, 화면 기록·손쉬운 사용 권한이 필요합니다. 가상 게임패드는 Windows 호스트에서만 제공합니다.",
    url: HOST_MAC_URL,
    fileName: "AlaveX-Host-macOS.dmg",
    missing:
      "사이트에 Mac 호스트 DMG는 없습니다. 앱은 host-app입니다. Mac에서 rustup 후 cd host-app && npm install && npm run tauri:build 하면 AlaveX Host.app과 DMG가 만들어집니다.",
  },
] as const;

const CLIENTS = [
  {
    key: "windows",
    platform: "Windows",
    stack: "React Native",
    format: "MSI",
    name: "Streaming · Windows",
    hint: "노트북·미니PC. UI는 apps/react-native",
    url: STREAMING_WIN_URL,
    fileName: "AlaveX-Streaming-Setup.msi",
    missing: "Windows MSI가 아직 없습니다.",
  },
  {
    key: "macos",
    platform: "macOS",
    stack: "SwiftUI",
    format: "DMG",
    name: "Streaming · Mac",
    hint: "apps/apple · swift run AlaveXStreaming",
    url: STREAMING_MAC_URL,
    fileName: "AlaveX-Streaming-macOS.dmg",
    missing:
      "DMG가 사이트에 없습니다. 받으면 웹페이지가 .dmg로 저장됩니다. Mac 클라이언트는 apps/apple에서 swift run AlaveXStreaming 으로 실행하세요.",
  },
  {
    key: "android",
    platform: "Android",
    stack: "React Native",
    format: "APK",
    name: "Streaming · Android",
    hint: "휴대폰·태블릿. apps/react-native",
    url: STREAMING_ANDROID_URL,
    fileName: "AlaveX-Streaming.apk",
    missing: "APK 주소를 확인하지 못했습니다.",
  },
  {
    key: "ios",
    platform: "iPhone / iPad",
    stack: "SwiftUI",
    format: "IPA",
    name: "Streaming · iOS",
    hint: "apps/apple · Xcode 스킴 AlaveX-iOS",
    url: null as string | null,
    fileName: "GitHub Actions → alavex-ios",
    missing: "iPhone은 apps/apple에서 Xcode 스킴 AlaveX-iOS로 빌드합니다. Apple 서명이 필요합니다.",
  },
] as const;

export function DownloadPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-base-800/80 bg-base-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher className="hidden sm:flex" />
            <Link to="/">
              <Button size="sm" variant="secondary">
                홈으로
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="text-center">
          <Badge tone="brand" className="mb-4">
            Host (Windows · macOS) · Client (Win / Mac / Android / iOS)
          </Badge>
          <h1 className="text-3xl font-bold text-heading sm:text-4xl">AlaveX 앱 다운로드</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            게이밍 PC에는 Host를, 플레이할 기기에는 Streaming 앱을 설치하세요. 웹사이트는
            소개·다운로드만 제공하며 실제 스트리밍은 네이티브 앱에서 동작합니다.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {HOSTS.map((host) => (
            <Card key={host.key} className="flex flex-col p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-100">{host.name}</h2>
                <Badge tone="neutral">{host.format}</Badge>
              </div>
              <p className="mt-1 text-sm font-medium text-brand-400">{host.tagline}</p>
              <p className="mt-3 text-sm text-slate-400">{host.description}</p>
              <div className="mt-6">
                <InstallerButton href={host.url} fileName={host.fileName} missing={host.missing} />
              </div>
            </Card>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-100">AlaveX Streaming 클라이언트</h2>
          <p className="mt-2 text-sm text-slate-400">
            Mac과 iPhone은 SwiftUI, Android와 Windows는 React Native입니다. 설치 파일이 실제로
            있을 때만 다운로드 버튼이 켜집니다.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CLIENTS.map((client) => (
              <Card key={client.key} className="flex flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">{client.name}</h3>
                  <Badge tone="neutral">
                    {client.stack} · {client.format}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-400">{client.hint}</p>
                <div className="mt-4 grow" />
                <InstallerButton
                  href={client.url}
                  fileName={client.fileName}
                  missing={client.missing}
                  variant="secondary"
                />
              </Card>
            ))}
          </div>
        </section>

        <Card className="mt-10 p-6">
          <h2 className="text-base font-semibold text-slate-100">설치 후 연결하는 방법</h2>
          <ol className="mt-4 space-y-3 text-sm text-slate-400">
            <li>
              <span className="font-medium text-slate-200">1. 게이밍 PC에 AlaveX Host를 설치하고 실행하세요.</span>
              <br />창에 표시되는 IP 주소와 4자리 PIN을 확인하세요.
            </li>
            <li>
              <span className="font-medium text-slate-200">
                2. 플레이할 기기에서 Streaming 앱(Windows / Mac / Android / iOS)을 여세요.
              </span>
              <br />
              계정으로 로그인하면 등록된 PC가 목록에 나타납니다. 수동 연결은{" "}
              <Link to="/app/pairing" className="text-brand-400 hover:underline">
                PC 페어링
              </Link>
              에서 IP + PIN을 입력하세요.
            </li>
            <li>
              <span className="font-medium text-slate-200">3. 두 기기가 같은 Wi-Fi/LAN에 있어야 합니다.</span>
            </li>
            <li>
              <span className="font-medium text-slate-200">4. 라이브러리에서 게임을 선택하고 스트리밍을 시작하세요.</span>
            </li>
          </ol>
          <p className="mt-5 rounded-xl border border-warn-500/30 bg-warn-500/5 p-3 text-xs text-warn-400">
            보안 참고: 시그널링 연결은 같은 네트워크 안에서만 동작하도록 설계되었습니다(암호화되지
            않은 로컬 WebSocket). 공용 인터넷으로 포트를 개방하지 마세요.
          </p>
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="text-base font-semibold text-slate-100">Android 설치 안내</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>· 설정 → 보안 → <span className="text-slate-300">알 수 없는 앱 설치</span> 허용</li>
            <li>· 이전에 설치한 AlaveX가 있으면 먼저 삭제 후 재설치</li>
            <li>· 다운로드가 HTML로 저장되면 Chrome 메뉴 → <span className="text-slate-300">다시 다운로드</span>로 APK를 받으세요</li>
            <li>· Wi‑Fi로 APK(~95MB) 받은 뒤 파일 관리자에서 `.apk`를 탭해 설치</li>
          </ul>
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="text-base font-semibold text-slate-100">저작권 · 독립성 고지</h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-500">
            <li>
              AlaveX는 <span className="text-slate-300">독립적인 프로젝트</span>이며 특정
              상용/오픈소스 원격 스트리밍 소프트웨어와 제휴·후원·파생 관계가 없습니다.
            </li>
            <li>
              "AlaveX" 이름·로고·UI·코드는 전부 이 프로젝트를 위해 새로 만든{" "}
              <span className="text-slate-300">오리지널 자산</span>이며, 타사 제품의 이름·로고·
              문구·이미지·코드를 그대로 사용하지 않습니다.
            </li>
            <li>
              언급될 수 있는 타사 제품명(예: Steam)은 각 소유자의 상표이며, 상호운용성 설명을
              위해서만 인용됩니다.
            </li>
          </ul>
        </Card>
      </main>
    </div>
  );
}

type InstallerStatus = "checking" | "ready" | "missing";

function useInstallerStatus(url: string | null): InstallerStatus {
  const [status, setStatus] = useState<InstallerStatus>(url ? "checking" : "missing");

  useEffect(() => {
    if (!url) {
      setStatus("missing");
      return;
    }
    if (url.startsWith("http")) {
      setStatus("ready");
      return;
    }
    const ctrl = new AbortController();
    fetch(url, { method: "HEAD", signal: ctrl.signal })
      .then((res) => {
        const type = res.headers.get("content-type") ?? "";
        setStatus(res.ok && !type.includes("text/html") ? "ready" : "missing");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("missing");
      });
    return () => ctrl.abort();
  }, [url]);

  return status;
}

function InstallerButton({
  href,
  fileName,
  missing,
  variant = "primary",
}: {
  href: string | null;
  fileName: string;
  missing: string;
  variant?: "primary" | "secondary";
}) {
  const status = useInstallerStatus(href);
  if (status === "ready" && href) {
    return (
      <>
        <DownloadLink href={href} fileName={fileName} variant={variant} external={href.startsWith("http")}>
          다운로드
        </DownloadLink>
        <p className="mt-2 text-center text-xs text-slate-600">{fileName}</p>
      </>
    );
  }
  return (
    <>
      <Button className="w-full" variant="secondary" disabled>
        {status === "checking" ? "파일 확인 중" : "설치 파일 없음"}
      </Button>
      {status === "missing" ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{missing}</p> : null}
    </>
  );
}

function DownloadLink({
  href,
  fileName,
  variant = "primary",
  external = false,
  children,
}: {
  href: string;
  fileName: string;
  variant?: "primary" | "secondary";
  external?: boolean;
  children: ReactNode;
}) {
  const className =
    variant === "primary"
      ? "inline-flex w-full items-center justify-center bg-brand-600 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-brand-500"
      : "inline-flex w-full items-center justify-center border border-base-600 bg-base-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-base-700";

  return (
    <a
      href={href}
      download={external ? undefined : fileName}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}
