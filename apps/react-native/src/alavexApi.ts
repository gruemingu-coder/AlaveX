export const AlaveXProtocol = {
  apiBaseURL: 'https://alavex.pages.dev/api',
  signalingPort: 47989,
  mediaPort: 47998,
  discoveryPort: 47999,
  appVersion: '0.5.0',
} as const;

export type AccountUser = {id: string; email: string};
export type AuthResult = {token: string; user: AccountUser};
export type CloudDevice = {
  id: string;
  name: string;
  macAddress?: string | null;
  lastIp?: string | null;
  publicHost?: string | null;
  signalPort: number;
  pairingPin?: string | null;
  lastSeenAt: string;
};
export type RemoteGame = {id: string; title: string};

export function resolveHostAddress(device: CloudDevice, useRemote: boolean): string {
  if (useRemote && device.publicHost) return device.publicHost;
  return device.lastIp ?? device.publicHost ?? '';
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${AlaveXProtocol.apiBaseURL}${path}`, {...init, headers});
  } catch {
    throw new Error('서버에 연결할 수 없습니다.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as {error?: string}).error ?? `요청 실패 (${res.status})`);
  return body as T;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return request('/auth/login', {method: 'POST', body: JSON.stringify({email, password})});
}

export async function signup(email: string, password: string): Promise<AuthResult> {
  return request('/auth/signup', {method: 'POST', body: JSON.stringify({email, password})});
}

export async function fetchMe(token: string): Promise<AccountUser> {
  const res = await request<{user: AccountUser}>('/auth/me', {method: 'GET'}, token);
  return res.user;
}

export async function listDevices(token: string): Promise<CloudDevice[]> {
  const res = await request<{devices: CloudDevice[]}>('/devices', {method: 'GET'}, token);
  return res.devices;
}

export type HandshakeResult = {
  hostName: string;
  games: RemoteGame[];
  macAddress?: string | null;
  mediaPort: number;
  mediaToken?: string | null;
};

export function connectSignaling(
  host: string,
  pin: string,
  clientName = 'AlaveX',
): Promise<HandshakeResult> {
  return new Promise((resolve, reject) => {
    const url = `ws://${host}:${AlaveXProtocol.signalingPort}/signal?role=client`;
    const ws = new WebSocket(url);
    ws.onopen = () => {
      ws.send(JSON.stringify({type: 'auth', pin, clientName}));
    };
    ws.onmessage = ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === 'auth-fail') {
        ws.close();
        reject(new Error(msg.reason ?? 'PIN 오류'));
      }
      if (msg.type === 'games') {
        ws.close();
        resolve({
          hostName: msg.hostName ?? 'Host',
          games: msg.games ?? [],
          macAddress: msg.macAddress ?? null,
          mediaPort: msg.mediaPort ?? AlaveXProtocol.mediaPort,
          mediaToken: msg.mediaToken ?? null,
        });
      }
    };
    ws.onerror = () => reject(new Error('WebSocket 연결 실패'));
  });
}
