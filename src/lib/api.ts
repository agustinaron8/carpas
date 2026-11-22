const TOKEN_KEY = 'carpas.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class AuthError extends Error {
  constructor() {
    super('Sesión vencida');
  }
}

/** Error de red (sin señal, timeout): no es culpa de los datos, se reintenta. */
export class NetworkError extends Error {}

export async function api<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new NetworkError('Sin conexión');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && path !== '/login') throw new AuthError();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Error ${res.status}`);
  return body as T;
}

export async function login(password: string): Promise<void> {
  const { token } = await api<{ token: string }>('/login', { method: 'POST', body: JSON.stringify({ password }) });
  setToken(token);
}
