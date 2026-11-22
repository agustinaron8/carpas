import { jwtVerify, SignJWT } from 'jose';

const DURACION = '180d';

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET falta o es muy corto');
  return new TextEncoder().encode(s);
}

/** Compara en tiempo constante para no filtrar la contraseña por tiempos. */
export function passwordOk(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const a = new TextEncoder().encode(input);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function signToken(): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(DURACION).sign(secret());
}

export async function tokenOk(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}
