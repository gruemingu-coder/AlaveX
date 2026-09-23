import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";

/** Shown whenever the AlaveX Host app launches without a valid saved session. */
export function LoginScreen() {
  const { login, signup, error, isSubmitting, clearError } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch {
      // Surfaced via `error` below.
    }
  };

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    clearError();
  };

  return (
    <div className="flex min-h-screen flex-col bg-base-950 text-slate-100">
      <header className="flex items-center gap-3 border-b border-base-700 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center bg-brand-600 text-sm font-semibold text-white">
          A
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-brand-400">AlaveX</p>
          <p className="text-base font-semibold leading-none">Host</p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">계정</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {mode === "login" ? "이 기기를 계정에 연결" : "호스트 계정 만들기"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          같은 계정으로 로그인한 스트리밍 앱에 이 Windows 또는 Mac이 자동으로 나타납니다.
        </p>

        <div className="mt-6 flex border border-base-700" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => switchMode("login")}
            className={`flex-1 px-3 py-2 text-sm ${
              mode === "login" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-slate-100"
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => switchMode("signup")}
            className={`flex-1 px-3 py-2 text-sm ${
              mode === "signup" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-slate-100"
            }`}
          >
            회원가입
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="host-login-email" className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-slate-400">
              이메일
            </label>
            <input
              id="host-login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-base-600 bg-base-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500"
            />
          </div>
          <div>
            <label htmlFor="host-login-password" className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-slate-400">
              비밀번호
            </label>
            <input
              id="host-login-password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
              className="w-full border border-base-600 bg-base-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "처리 중..." : mode === "login" ? "로그인" : "가입하고 시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
