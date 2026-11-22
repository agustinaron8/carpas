// Carga inicial desde el Docs "Carpas 2026" (.docx). Se corre una vez:
//
//   npx tsx scripts/import-docx.ts --dry-run                       # solo muestra qué haría y escribe el reporte
//   npx tsx scripts/import-docx.ts --api http://localhost:5173      # contra la API local (npm run dev)
//   BLOB_READ_WRITE_TOKEN=... npx tsx scripts/import-docx.ts --api https://<app>.vercel.app --password <clave>
//
// Los ids salen del nombre, así que correrlo de nuevo no duplica. Si una carpa ya está en el servidor
// se saltea (para no pisar cambios hechos en la app), salvo con --force.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import type { Carpa, Foto, PullResponse, PushItem, PushResult } from '../shared/model.js';
import { interpretar, leerDocx, type Importada } from './docx/parse.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

const DOCX = opt('docx', 'scripts/data/Carpas-2026.docx')!;
const API = (opt('api', 'http://localhost:5173') ?? '').replace(/\/$/, '');
const PASSWORD = opt('password', process.env.APP_PASSWORD ?? 'carpas')!;
const FECHA_SIN_DATO = opt('fecha-sin-dato', '2026-01-01')!;
const REPORTE = 'scripts/data/import-report.md';

/** UUID v5-like determinístico: el mismo nombre da siempre el mismo id. */
function idDe(s: string): string {
  const h = createHash('sha1').update(`carpas-2026:${s}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

async function main() {
  const { tablas, media, sueltos } = await leerDocx(readFileSync(DOCX));
  const now = Date.now();
  const vistos = new Map<string, number>();
  const importadas: Importada[] = [];
  for (const [i, t] of tablas.entries()) {
    const imp = interpretar(t, { id: idDe, codigo: `C-${String(i + 1).padStart(2, '0')}`, now, fechaSinDato: FECHA_SIN_DATO });
    const n = imp.carpa.nombre.toLowerCase();
    if (vistos.has(n)) {
      imp.avisos.push(`Nombre repetido con ${importadas[vistos.get(n)!].carpa.codigo}`);
      imp.carpa.id = idDe(`carpa:${imp.carpa.nombre}#${i}`);
      if (imp.revision) imp.revision = { ...imp.revision, id: idDe(`revision:${imp.carpa.nombre}#${i}`), carpaId: imp.carpa.id };
    }
    vistos.set(n, i);
    if (imp.imagen && (media.get(imp.imagen)?.length ?? 0) < 1000) {
      imp.avisos.push('La foto del Docs está rota (no se puede abrir)');
      imp.imagen = null;
    }
    importadas.push(imp);
  }

  escribirReporte(importadas, sueltos);
  console.log(`${importadas.length} carpas, ${importadas.filter((x) => x.revision).length} revisiones, ${importadas.filter((x) => x.imagen).length} fotos.`);
  console.log(`Reporte: ${REPORTE}`);
  if (flag('dry-run')) {
    if (flag('json')) console.log(JSON.stringify(importadas, null, 2));
    return;
  }

  const token = await login();
  const existentes = await pullCarpas(token);
  const items: PushItem[] = [];
  let salteadas = 0;
  for (const imp of importadas) {
    if (existentes.has(imp.carpa.id) && !flag('force')) {
      salteadas++;
      continue;
    }
    const carpa: Carpa = { ...imp.carpa };
    if (imp.imagen) {
      const foto = await subirFoto(token, carpa, media.get(imp.imagen)!, now);
      carpa.fotoPrincipalId = foto.id;
      items.push({ entidad: 'carpas', row: carpa }, { entidad: 'fotos', row: foto });
    } else items.push({ entidad: 'carpas', row: carpa });
    if (imp.revision) items.push({ entidad: 'revisiones', row: imp.revision });
    process.stdout.write('.');
  }
  console.log();
  if (salteadas) console.log(`${salteadas} carpas ya estaban en el servidor y se saltearon (usá --force para pisarlas).`);
  if (!items.length) return;
  const res = await fetch(`${API}/api/sync/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`push: ${res.status} ${await res.text()}`);
  const { results } = (await res.json()) as { results: PushResult[] };
  const errores = results.filter((r) => !r.ok);
  console.log(`Subidos: ${results.length - errores.length} registros. Errores: ${errores.length}.`);
  for (const e of errores) console.log(' -', e.entidad, e.id, !e.ok && e.error);
  if (errores.length) process.exitCode = 1;
}

async function login(): Promise<string> {
  const res = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { token: string }).token;
}

async function pullCarpas(token: string): Promise<Set<string>> {
  const res = await fetch(`${API}/api/sync/pull?since=0`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`pull: ${res.status}`);
  const data = (await res.json()) as PullResponse;
  return new Set(data.carpas.filter((c) => !c.deletedAt).map((c) => c.id));
}

async function subirFoto(token: string, carpa: Carpa, bytes: Uint8Array, now: number): Promise<Foto> {
  const img = sharp(Buffer.from(bytes)).rotate();
  const full = await img.clone().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const thumb = await img.clone().resize(400, 400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75, mozjpeg: true }).toBuffer();
  const id = idDe(`foto:${carpa.nombre}`);
  const url = await subir(token, `fotos/${carpa.id}/${id}.jpg`, full);
  const thumbUrl = await subir(token, `fotos/${carpa.id}/${id}-thumb.jpg`, thumb);
  return { id, carpaId: carpa.id, revisionId: null, url, thumbUrl, orden: 1, createdAt: now, updatedAt: now, deletedAt: null };
}

async function subir(token: string, pathname: string, data: Buffer): Promise<string> {
  // En producción: `vercel env pull` deja BLOB_STORE_ID y VERCEL_OIDC_TOKEN (o un BLOB_READ_WRITE_TOKEN).
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const r = await put(pathname, data, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: true, cacheControlMaxAge: 31536000 });
    return r.url;
  }
  // API local (scripts/dev-api.ts) sin cuenta de Vercel.
  const res = await fetch(`${API}/api/dev-blob/${pathname}`, { method: 'PUT', body: new Uint8Array(data), headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Subida de foto: ${res.status}. Para producción hacen falta las variables de "vercel env pull".`);
  return new URL(((await res.json()) as { url: string }).url, API).href;
}

function escribirReporte(importadas: Importada[], sueltos: string[]) {
  const l: string[] = ['# Importación del Docs "Carpas 2026"', ''];
  l.push(`${importadas.length} carpas. Fecha usada cuando el Docs no dice cuándo se revisó: ${FECHA_SIN_DATO}.`, '');
  l.push('| Código | Nombre | Tipo | Estado general | Revisión | Foto |', '|---|---|---|---|---|---|');
  for (const x of importadas) {
    l.push(`| ${x.carpa.codigo} | ${x.carpa.nombre} | ${x.carpa.tipo} | ${x.carpa.estadoGeneral} | ${x.revision ? x.revision.fecha : '—'} | ${x.imagen ? 'sí' : 'no'} |`);
  }
  l.push('', '## Detalle por carpa', '');
  for (const x of importadas) {
    l.push(`### ${x.carpa.codigo} · ${x.carpa.nombre}`);
    if (x.revision) {
      const r = x.revision;
      const comp = (['bolsa', 'cuerpo', 'cierres', 'parantes', 'estacas', 'vientos', 'sobretecho'] as const)
        .map((k) => `${k}: **${r[`${k}Estado`] ?? '—'}**${k === 'estacas' && r.estacasCantidad !== null ? ` (${r.estacasCantidad})` : ''}${r[`${k}Nota`] ? ` "${r[`${k}Nota`]}"` : ''}`)
        .join(' · ');
      l.push(`- ${comp}`);
      l.push(`- Tribu: ${r.tribu ?? '—'} · Campa: ${r.campa ?? '—'} · Personas: ${r.cantidadPersonas ?? '—'} · Dirigente: ${r.dirigenteTribu ?? '—'} · Revisó: ${r.dirigenteComision ?? '—'}`);
      if (r.observaciones) l.push(`- Observaciones: ${r.observaciones}`);
    }
    for (const a of x.avisos) l.push(`- ⚠ ${a}`);
    l.push('');
  }
  if (sueltos.length) l.push('## Texto fuera de las tablas (no se importó)', '', ...sueltos.map((s) => `- ${s}`), '');
  writeFileSync(REPORTE, l.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
