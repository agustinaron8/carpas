import { Hono } from 'hono';
import { del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
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

app.post('/sync/push', async (c) => {
  const parsed = pushBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Pedido inválido' }, 400);
  const results = await push(getDb(), parsed.data.items, async (foto) => {
    if (process.env.BLOB_READ_WRITE_TOKEN) await del([foto.url, foto.thumbUrl]);
  });
  return c.json({ results });
});

app.get('/sync/pull', async (c) => {
  const since = Number(c.req.query('since') ?? 0);
  return c.json(await pull(getDb(), Number.isFinite(since) ? since : 0));
});

app.post('/blob/upload', async (c) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return c.json({ error: 'Almacenamiento de fotos no configurado' }, 503);
  const body = (await c.req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: c.req.raw,
    onBeforeGenerateToken: async (pathname) => {
      if (!pathname.startsWith('fotos/')) throw new Error('Ruta inválida');
      return {
        allowedContentTypes: ['image/jpeg', 'image/webp', 'image/png'],
        maximumSizeInBytes: 5 * 1024 * 1024,
        addRandomSuffix: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      };
    },
  });
  return c.json(result);
});
