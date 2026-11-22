import { Hono } from 'hono';
import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { pushBodySchema } from '../shared/validation.js';
import { passwordOk, signToken, tokenOk } from './auth.js';
import { getDb } from './db/client.js';
import { pull, push } from './sync.js';

export const app = new Hono().basePath('/api');

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Error del servidor' }, 500);
});

app.get('/health', (c) => c.json({ ok: true }));

app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!passwordOk(password)) {
    await new Promise((r) => setTimeout(r, 500));
    return c.json({ error: 'Contraseña incorrecta' }, 401);
  }
  return c.json({ token: await signToken() });
});

app.use('*', async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !(await tokenOk(token))) return c.json({ error: 'Sesión vencida' }, 401);
  await next();
});

// Sesión deslizante: el celular pide un token nuevo al sincronizar, así no vence mientras se use.
app.post('/session/renew', async (c) => c.json({ token: await signToken() }));

app.post('/sync/push', async (c) => {
  const parsed = pushBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Pedido inválido' }, 400);
  const results = await push(getDb(), parsed.data.items);
  return c.json({ results });
});

app.get('/sync/pull', async (c) => {
  const since = Number(c.req.query('since') ?? 0);
  return c.json(await pull(getDb(), Number.isFinite(since) ? since : 0));
});

/** En Vercel el store se conecta por OIDC (BLOB_STORE_ID); con un token de lectura y escritura también anda. */
function blobConfigurado(): boolean {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

const TIPOS_FOTO = ['image/jpeg', 'image/webp', 'image/png'];
const MAX_FOTO = 5 * 1024 * 1024;

// Subida directa del celular a Blob con una URL firmada que vale para una sola ruta.
app.post('/blob/upload', async (c) => {
  if (!blobConfigurado()) return c.json({ error: 'Almacenamiento de fotos no configurado' }, 503);
  const body = (await c.req.json()) as HandleUploadPresignedBody;
  const result = await handleUploadPresigned({
    body,
    request: c.req.raw,
    getSignedToken: async (pathname) => {
      if (!/^fotos\/[\w-]+\/[\w.-]+$/.test(pathname)) throw new Error('Ruta inválida');
      const token = await issueSignedToken({
        pathname,
        operations: ['put'],
        allowedContentTypes: TIPOS_FOTO,
        maximumSizeInBytes: MAX_FOTO,
        validUntil: Date.now() + 10 * 60_000,
      });
      return {
        token,
        urlOptions: {
          allowedContentTypes: TIPOS_FOTO,
          maximumSizeInBytes: MAX_FOTO,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        },
      };
    },
  });
  return c.json(result);
});
