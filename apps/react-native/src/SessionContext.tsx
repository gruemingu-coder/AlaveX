import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  AccountUser,
  CloudDevice,
  fetchMe,
  listDevices,
  login as apiLogin,
  signup as apiSignup,
} from './alavexApi';

type SessionContextValue = {
  token: string | null;
  user: AccountUser | null;
  devices: CloudDevice[];
  useRemote: boolean;
  error: string | null;
  login: (email: string, password: string, signup?: boolean) => Promise<void>;
  logout: () => void;
  refreshDevices: () => Promise<void>;
  setUseRemote: (value: boolean) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const TOKEN_KEY = 'alavex.token';
const REMOTE_KEY = 'alavex.remote';

// AsyncStorage is optional until native deps are linked; fallback to memory.
let storage: {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  storage = require('@react-native-async-storage/async-storage').default;
} catch {
  const mem = new Map<string, string>();
  storage = {
    getItem: async k => mem.get(k) ?? null,
    setItem: async (k, v) => {
      mem.set(k, v);
    },
    removeItem: async k => {
      mem.delete(k);
    },
  };
}

export function SessionProvider({children}: {children: React.ReactNode}) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const [useRemote, setUseRemoteState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await storage.getItem(TOKEN_KEY);
      const r = await storage.getItem(REMOTE_KEY);
      if (t) setToken(t);
      if (r === 'true') setUseRemoteState(true);
    })();
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!token) return;
    try {
      setUser(await fetchMe(token));
      setDevices(await listDevices(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    }
  }, [token]);

  useEffect(() => {
    if (token) refreshDevices();
  }, [token, refreshDevices]);

  const login = useCallback(async (email: string, password: string, signup = false) => {
    setError(null);
    try {
      const result = signup ? await apiSignup(email, password) : await apiLogin(email, password);
      await storage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    }
  }, []);

  const logout = useCallback(async () => {
    await storage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setDevices([]);
  }, []);

  const setUseRemote = useCallback(async (value: boolean) => {
    await storage.setItem(REMOTE_KEY, value ? 'true' : 'false');
    setUseRemoteState(value);
  }, []);

  const value = useMemo(
    () => ({token, user, devices, useRemote, error, login, logout, refreshDevices, setUseRemote}),
    [token, user, devices, useRemote, error, login, logout, refreshDevices, setUseRemote],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('SessionProvider required');
  return ctx;
}
