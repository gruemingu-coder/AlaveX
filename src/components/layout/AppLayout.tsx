import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Logo } from "./Logo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { useAppState } from "@/state/AppStateContext";

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { devices } = useAppState();
  const onlineCount = devices.filter((d) => d.status === "online").length;

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-base-950">
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-3 top-3 z-50 bg-brand-600 px-4 py-2 text-sm font-medium text-white"
      >
        본문으로 건너뛰기
      </a>

      <header className="sticky top-0 z-40 border-b border-base-700 bg-base-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo size="sm" />
          <div className="hidden min-w-0 flex-1 md:block">
            <Sidebar layout="bar" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="hidden text-xs text-slate-400 lg:block">
              <span className="font-medium text-accent-400">{onlineCount}</span>
              <span> / {devices.length} 온라인</span>
            </p>
            <ThemeSwitcher className="hidden sm:flex" />
            <button
              type="button"
              aria-label="메뉴 열기"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center border border-base-700 text-slate-300 hover:bg-base-800 md:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="min-w-0 flex-1">
        <Outlet />
      </main>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="메뉴 닫기"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80vw] border-r border-base-700 bg-base-950">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
