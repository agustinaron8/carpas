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

// ---------- Sesión sin señal ----------
// Al entrar con señal se guarda una huella de la contraseña (PBKDF2, no la contraseña). Al cerrar sesión,
// el token queda guardado aparte. Sin señal, si la contraseña coincide con la huella, se recupera ese token.
const HUELLA_KEY = 'carpas.huella';
const GUARDADO_KEY = 'carpas.token.guardado';

function leer(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function huella(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 200_000 }, key, 256);
  return b64(bits);
}

async function guardarHuella(password: string): Promise<void> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(HUELLA_KEY, JSON.stringify({ salt: b64(salt), hash: await huella(password, salt) }));
  } catch {
    // sin almacenamiento: no se podrá entrar sin señal, nada más
  }
}

async function huellaCoincide(password: string): Promise<boolean> {
  const raw = leer(HUELLA_KEY);
  if (!raw) return false;
  try {
    const { salt, hash } = JSON.parse(raw) as { salt: string; hash: string };
    const s = Uint8Array.from(atob(salt), (ch) => ch.charCodeAt(0));
    return (await huella(password, s)) === hash;
  } catch {
    return false;
  }
}

/** Se puede entrar sin señal si este celular ya entró alguna vez con señal. */
export function puedeEntrarSinSenal(): boolean {
  return Boolean(leer(HUELLA_KEY) && leer(GUARDADO_KEY));
}

export class SinSenalError extends Error {}

export async function login(password: string): Promise<void> {
  try {
    const { token } = await api<{ token: string }>('/login', { method: 'POST', body: JSON.stringify({ password }) });
    setToken(token);
    try {
      localStorage.setItem(GUARDADO_KEY, token);
    } catch {
      // ídem
    }
    await guardarHuella(password);
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    if (!puedeEntrarSinSenal()) throw new SinSenalError('Para entrar por primera vez en este celular hace falta señal.');
    if (!(await huellaCoincide(password))) throw new Error('Contraseña incorrecta');
    setToken(leer(GUARDADO_KEY));
  }
}

/** Cierra la sesión pero deja el token guardado, para poder volver a entrar sin señal. */
export function logout(): void {
  setToken(null);
}

/** Antigüedad del token actual, en ms (según su fecha de emisión). */
export function edadToken(): number {
  const t = getToken();
  if (!t) return Infinity;
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { iat?: number };
    return payload.iat ? Date.now() - payload.iat * 1000 : Infinity;
  } catch {
    return Infinity;
  }
}

/** Pide un token nuevo con el actual. Lo llama el sync, con señal. */
export async function renovarToken(): Promise<void> {
  const { token } = await api<{ token: string }>('/session/renew', { method: 'POST' });
  setToken(token);
  try {
    localStorage.setItem(GUARDADO_KEY, token);
  } catch {
    // ídem
  }
}
