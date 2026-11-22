// API local en :8787 con PGlite en .pglite/. Vite la expone en /api.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { setDb } from '../server/db/client.js';

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // sin .env.local
}
process.env.APP_PASSWORD ??= 'carpas';
process.env.AUTH_SECRET ??= 'secreto-de-desarrollo-no-usar-en-produccion';

if (!process.env.DATABASE_URL) {
  const { createLocalDb } = await import('../server/db/local.js');
  setDb(await createLocalDb(process.env.PGLITE_DIR ?? '.pglite'));
}
const { app } = await import('../server/app.js');
const { tokenOk } = await import('../server/auth.js');

// Emula Vercel Blob en disco para probar las fotos sin cuenta.
const blobDir = join(process.env.PGLITE_DIR ?? '.pglite', 'blobs');
const root = new Hono();
root.put('/api/dev-blob/*', async (c) => {
  const token = (c.req.header('authorization') ?? '').slice(7);
  if (!(await tokenOk(token))) return c.json({ error: 'Sesión vencida' }, 401);
  const name = `${randomUUID().slice(0, 8)}-${c.req.path.slice('/api/dev-blob/'.length).replace(/[^\w.-]/g, '_')}`;
  await mkdir(blobDir, { recursive: true });
  await writeFile(join(blobDir, name), Buffer.from(await c.req.arrayBuffer()));
  return c.json({ url: `/api/dev-blob/${name}` });
});
root.get('/api/dev-blob/:name', async (c) => {
  try {
    const data = await readFile(join(blobDir, basename(c.req.param('name'))));
    return c.body(data, 200, { 'content-type': 'image/jpeg', 'access-control-allow-origin': '*' });
  } catch {
    return c.notFound();
  }
});
root.route('/', app);

const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: root.fetch, port });
console.log(`API en http://localhost:${port}/api · contraseña: ${process.env.APP_PASSWORD}`);
