// Sube el outbox, baja lo nuevo y sube las fotos pendientes.
import { useSyncExternalStore } from 'react';
import { ENTIDADES, type Entidad, type EntityMap, type PullResponse, type PushItem, type PushResult } from '../../shared/model';
import { db, getMeta, setMeta, type LocalFoto } from '../db/dexie';
import { onLocalWrite } from '../db/repo';
import { api, AuthError, edadToken, getToken, NetworkError, renovarToken } from '../lib/api';
import { prefetchThumbs, uploadPendingFotos } from './fotos';

export interface SyncState {
  online: boolean;
  syncing: boolean;
  lastSync: number | null;
  /** Error general del último intento (sin incluir la falta de señal). */
  error: string | null;
  authError: boolean;
}

let state: SyncState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  lastSync: null,
  error: null,
  authError: false,
};
const subs = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const f of subs) f();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}

type ToastFn = (msg: string) => void;
let toast: ToastFn = () => undefined;
export function setSyncToast(f: ToastFn) {
  toast = f;
}

let running: Promise<void> | null = null;
let again = false;
/** Hubo un corte desde el último sync exitoso: al volver, avisamos lo que se subió. */
let huboCorte = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce() {
  if (!getToken()) return;
  if (!navigator.onLine) {
    huboCorte = true;
    set({ online: false });
    return;
  }
  set({ syncing: true, online: true });
  try {
    await uploadPendingFotos();
    const subidos = await pushOutbox();
    await pullChanges();
    // Sesión deslizante: renueva el token una vez por día de uso.
    if (edadToken() > 24 * 3600_000) await renovarToken().catch(() => undefined);
    const now = Date.now();
    await setMeta('lastSync', now);
    set({ lastSync: now, error: null, authError: false, online: true });
    if (subidos > 0 && huboCorte) toast(`Se subieron ${subidos} ${subidos === 1 ? 'cambio' : 'cambios'} ✓`);
    huboCorte = false;
    void prefetchThumbs();
  } catch (err) {
    if (err instanceof AuthError) set({ authError: true, error: 'Sesión vencida' });
    else if (err instanceof NetworkError) {
      // navigator.onLine puede decir que hay red con señal débil o wifi sin internet.
      huboCorte = true;
      set({ error: null, online: false });
    } else set({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    set({ syncing: false });
  }
}

async function readRow(entidad: Entidad, id: string): Promise<EntityMap[Entidad] | undefined> {
  const row = await db.table(entidad).get(id);
  if (!row) return undefined;
  if (entidad === 'fotos') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { blob, thumbBlob, uploadError, ...rest } = row as LocalFoto;
    if (!rest.url) return undefined;
    return rest;
  }
  return row;
}

/** Devuelve cuántos registros se subieron bien. */
async function pushOutbox(): Promise<number> {
  const entries = await db.outbox.toArray();
  if (entries.length === 0) return 0;
  let ok = 0;
  for (let i = 0; i < entries.length; i += 200) {
    const chunk = entries.slice(i, i + 200);
    const items: PushItem[] = [];
    for (const e of chunk) {
      const row = await readRow(e.entidad, e.entityId);
      if (row) items.push({ entidad: e.entidad, row });
      else await db.outbox.delete(e.key);
    }
    if (items.length === 0) continue;
    const { results } = await api<{ results: PushResult[] }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    const sent = new Map(chunk.map((e) => [e.key, e.updatedAt]));
    await db.transaction('rw', [db.outbox, ...ENTIDADES.map((e) => db.table(e))], async () => {
      for (const r of results) {
        const key = `${r.entidad}:${r.id}`;
        const entry = await db.outbox.get(key);
        // Si se editó mientras subía, la entrada nueva se queda para el próximo push.
        const sinCambios = entry && entry.updatedAt === sent.get(key);
        if (r.ok) {
          ok++;
          if (sinCambios) await db.outbox.delete(key);
          if (r.current && sinCambios) await applyRow(r.entidad, r.current);
        } else if (entry) {
          await db.outbox.update(key, { error: r.error, attempts: (entry.attempts ?? 0) + 1 });
        }
      }
    });
  }
  return ok;
}

async function applyRow(entidad: Entidad, row: EntityMap[Entidad]) {
  if (entidad === 'fotos') {
    const local = await db.fotos.get(row.id);
    await db.fotos.put({
      ...(row as EntityMap['fotos']),
      blob: local?.blob,
      thumbBlob: local && local.thumbUrl === (row as EntityMap['fotos']).thumbUrl ? local.thumbBlob : undefined,
    });
  } else {
    await db.table(entidad).put(row);
  }
}

async function pullChanges() {
  const since = (await getMeta<number>('cursor')) ?? 0;
  const res = await api<PullResponse>(`/sync/pull?since=${since}`, {}, 45_000);
  await db.transaction('rw', [db.outbox, db.meta, ...ENTIDADES.map((e) => db.table(e))], async () => {
    const pendientes = new Set((await db.outbox.toArray()).map((e) => e.key));
    for (const entidad of ENTIDADES) {
      // `?? []`: un servidor anterior no manda las entidades nuevas.
      for (const row of res[entidad] ?? []) {
        // Lo que todavía no subimos gana: el servidor decide al recibirlo.
        if (pendientes.has(`${entidad}:${row.id}`)) continue;
        const local = (await db.table(entidad).get(row.id)) as { updatedAt: number } | undefined;
        if (local && local.updatedAt > row.updatedAt) continue;
        await applyRow(entidad, row);
      }
    }
    await setMeta('cursor', res.cursor);
  });
}

/** Vuelve a bajar todo desde cero (no borra lo pendiente). */
export async function resetCursor() {
  await setMeta('cursor', 0);
  await syncNow();
}

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  void getMeta<number>('lastSync').then((v) => set({ lastSync: v ?? null }));
  window.addEventListener('online', () => {
    set({ online: true });
    void syncNow();
  });
  window.addEventListener('offline', () => {
    huboCorte = true;
    set({ online: false });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  onLocalWrite(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  });
  setInterval(() => {
    if (navigator.onLine && document.visibilityState === 'visible') void syncNow();
  }, 2 * 60_000);
  void syncNow();
}
