// Escrituras de la app. Todas pasan por acá para que quede la entrada en el outbox.
import type { Carpa, Entidad, Evento, EventoCarpa, Revision } from '../../shared/model';
import { db, type LocalFoto } from './dexie';

type Listener = () => void;
const listeners = new Set<Listener>();
/** El syncService se suscribe para subir apenas hay un cambio. */
export function onLocalWrite(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) fn();
}

function enqueue(entidad: Entidad, id: string, updatedAt: number) {
  return db.outbox.put({ key: `${entidad}:${id}`, entidad, entityId: id, updatedAt, error: null, attempts: 0 });
}

export const uuid = () => crypto.randomUUID();

export async function saveCarpa(data: Omit<Carpa, 'createdAt' | 'updatedAt' | 'deletedAt'> & Partial<Carpa>): Promise<Carpa> {
  const now = Date.now();
  const carpa: Carpa = {
    ...data,
    createdAt: data.createdAt ?? now,
    updatedAt: now,
    deletedAt: data.deletedAt ?? null,
  };
  await db.transaction('rw', db.carpas, db.outbox, async () => {
    await db.carpas.put(carpa);
    await enqueue('carpas', carpa.id, now);
  });
  notify();
  return carpa;
}

export async function deleteCarpa(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.carpas, db.outbox, async () => {
    await db.carpas.update(id, { deletedAt: now, updatedAt: now });
    await enqueue('carpas', id, now);
  });
  notify();
}

export async function saveRevision(rev: Revision): Promise<Revision> {
  const now = Date.now();
  const r = { ...rev, updatedAt: now };
  await db.transaction('rw', db.revisiones, db.outbox, async () => {
    await db.revisiones.put(r);
    await enqueue('revisiones', r.id, now);
  });
  notify();
  return r;
}

export async function deleteRevision(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.revisiones, db.fotos, db.outbox, async () => {
    await db.revisiones.update(id, { deletedAt: now, updatedAt: now });
    await enqueue('revisiones', id, now);
    // Sus fotos se van con ella (también en forma lógica).
    for (const f of await db.fotos.where('revisionId').equals(id).toArray()) {
      if (!f.deletedAt) await marcarFotoBorrada(f, now);
    }
  });
  notify();
}

/**
 * La foto queda local; el uploader la sube y recién ahí entra al outbox.
 * Con `revisionId` es una foto de esa revisión (ej. del daño) y no cuenta como foto de la carpa.
 */
export async function addFoto(carpaId: string, blob: Blob, thumbBlob: Blob, revisionId: string | null = null): Promise<LocalFoto> {
  const now = Date.now();
  const orden = (await db.fotos.where('carpaId').equals(carpaId).filter((f) => (f.revisionId ?? null) === revisionId).count()) + 1;
  const foto: LocalFoto = {
    id: uuid(),
    carpaId,
    revisionId,
    url: '',
    thumbUrl: '',
    orden,
    blob,
    thumbBlob,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    uploadError: null,
  };
  await db.transaction('rw', db.fotos, db.carpas, db.outbox, async () => {
    await db.fotos.put(foto);
    const carpa = await db.carpas.get(carpaId);
    if (carpa && !carpa.fotoPrincipalId && !revisionId) {
      await db.carpas.update(carpaId, { fotoPrincipalId: foto.id, updatedAt: now });
      await enqueue('carpas', carpaId, now);
    }
  });
  notify();
  return foto;
}

export async function deleteFoto(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.fotos, db.carpas, db.outbox, async () => {
    const foto = await db.fotos.get(id);
    if (!foto) return;
    await marcarFotoBorrada(foto, now);
    const carpa = await db.carpas.get(foto.carpaId);
    if (carpa?.fotoPrincipalId === id) {
      const otra = (await db.fotos.where('carpaId').equals(foto.carpaId).toArray())
        .filter((f) => f.id !== id && !f.deletedAt && !f.revisionId)
        .sort((a, b) => a.orden - b.orden)[0];
      await db.carpas.update(carpa.id, { fotoPrincipalId: otra?.id ?? null, updatedAt: now });
      await enqueue('carpas', carpa.id, now);
    }
  });
  notify();
}

export async function setFotoPrincipal(carpaId: string, fotoId: string): Promise<void> {
  const carpa = await db.carpas.get(carpaId);
  if (carpa) await saveCarpa({ ...carpa, fotoPrincipalId: fotoId });
}

/**
 * Borrado lógico: nunca se pierde una foto. Si ya está en Blob, se libera el espacio en el celular;
 * si no, se guarda para subirla igual (marcada como borrada) y poder recuperarla desde la base.
 */
async function marcarFotoBorrada(foto: LocalFoto, now: number) {
  if (foto.url) {
    await db.fotos.update(foto.id, { deletedAt: now, updatedAt: now, blob: undefined, thumbBlob: undefined });
    await enqueue('fotos', foto.id, now);
  } else {
    await db.fotos.update(foto.id, { deletedAt: now, updatedAt: now });
  }
}

/** Marca la foto como subida y la encola para que viaje su fila. */
export async function markFotoUploaded(id: string, url: string, thumbUrl: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.fotos, db.outbox, async () => {
    await db.fotos.update(id, { url, thumbUrl, updatedAt: now, uploadError: null });
    await enqueue('fotos', id, now);
  });
}

type Nuevo<T> = Omit<T, 'createdAt' | 'updatedAt' | 'deletedAt'> & Partial<T>;

export async function saveEvento(data: Nuevo<Evento>): Promise<Evento> {
  const now = Date.now();
  const ev: Evento = { ...data, createdAt: data.createdAt ?? now, updatedAt: now, deletedAt: data.deletedAt ?? null };
  await db.transaction('rw', db.eventos, db.outbox, async () => {
    await db.eventos.put(ev);
    await enqueue('eventos', ev.id, now);
  });
  notify();
  return ev;
}

/** Borra el evento y sus carpas (todo lógico). Las carpas del inventario no se tocan. */
export async function deleteEvento(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.eventos, db.eventoCarpas, db.outbox, async () => {
    await db.eventos.update(id, { deletedAt: now, updatedAt: now });
    await enqueue('eventos', id, now);
    for (const ec of await db.eventoCarpas.where('eventoId').equals(id).toArray()) {
      if (ec.deletedAt) continue;
      await db.eventoCarpas.update(ec.id, { deletedAt: now, updatedAt: now });
      await enqueue('eventoCarpas', ec.id, now);
    }
  });
  notify();
}

/**
 * Id fijo para (evento, carpa del inventario): si dos celulares la agregan sin señal, queda una sola
 * fila; y si se quita y se vuelve a agregar, revive la misma.
 */
export async function idEventoCarpa(eventoId: string, carpaId: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${eventoId}:${carpaId}`)));
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = [...h.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export function eventoCarpaVacia(eventoId: string, id: string, carpaId: string | null): EventoCarpa {
  return {
    id,
    eventoId,
    carpaId,
    nombre: null,
    prestadaPor: null,
    capacidad: null,
    devuelta: false,
    tribu: null,
    cantidad: null,
    genero: null,
    dirigente: null,
    observaciones: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

/** Guarda varias a la vez (ej. al agregar carpas del inventario). */
export async function saveEventoCarpas(rows: EventoCarpa[]): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.eventoCarpas, db.outbox, async () => {
    for (const r of rows) {
      await db.eventoCarpas.put({ ...r, createdAt: r.createdAt || now, updatedAt: now });
      await enqueue('eventoCarpas', r.id, now);
    }
  });
  notify();
}

export async function deleteEventoCarpa(id: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.eventoCarpas, db.outbox, async () => {
    await db.eventoCarpas.update(id, { deletedAt: now, updatedAt: now });
    await enqueue('eventoCarpas', id, now);
  });
  notify();
}
