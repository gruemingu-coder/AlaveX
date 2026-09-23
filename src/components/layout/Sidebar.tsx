import { Link, NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { useAppState } from "@/state/AppStateContext";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
}

const navItems: NavItem[] = [
  {
    to: "/app/devices",
    label: "내 PC",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    to: "/app/library",
    label: "게임 라이브러리",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: "/app/settings",
    label: "설정",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path
          strokeLinecap="round"
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        />
      </svg>
    ),
  },
];

interface SidebarProps {
  onNavigate?: () => void;
  layout?: "stack" | "bar";
}

export function Sidebar({ onNavigate, layout = "stack" }: SidebarProps) {
  const { devices } = useAppState();
  const onlineCount = devices.filter((d) => d.status === "online").length;
  const bar = layout === "bar";

  return (
    <nav
      aria-label="주요 메뉴"
      className={
        bar
          ? "flex items-center gap-1"
          : "flex h-full w-full flex-col justify-between bg-base-950 px-4 py-5"
      }
    >
      <div className={bar ? "contents" : undefined}>
        {!bar && (
          <Link to="/app/devices" className="mb-8 flex items-center px-2" onClick={onNavigate}>
            <Logo size="sm" />
          </Link>
        )}
        <ul className={bar ? "flex items-center gap-1" : "flex flex-col gap-1"}>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-b-2 border-brand-500 text-heading"
                      : "border-b-2 border-transparent text-slate-400 hover:text-heading"
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {!bar && (
        <div className="flex flex-col gap-3">
          <div className="border border-base-700 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">페어링된 PC</p>
            <p className="mt-1 text-sm text-slate-200">
              <span className="font-semibold text-accent-400">{onlineCount}</span>
              <span className="text-slate-500"> / {devices.length}대 온라인</span>
            </p>
          </div>
          <ThemeSwitcher className="justify-center" />
        </div>
      )}
    </nav>
  );
}
