// Escrituras de la app. Todas pasan por acá para que quede la entrada en el outbox.
import type { Carpa, Entidad, Revision } from '../../shared/model';
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
  await db.transaction('rw', db.revisiones, db.outbox, async () => {
    await db.revisiones.update(id, { deletedAt: now, updatedAt: now });
    await enqueue('revisiones', id, now);
  });
  notify();
}

/** La foto queda local; el uploader la sube y recién ahí entra al outbox. */
export async function addFoto(carpaId: string, blob: Blob, thumbBlob: Blob): Promise<LocalFoto> {
  const now = Date.now();
  const orden = (await db.fotos.where('carpaId').equals(carpaId).count()) + 1;
  const foto: LocalFoto = {
    id: uuid(),
    carpaId,
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
    if (carpa && !carpa.fotoPrincipalId) {
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
    if (!foto.url) {
      // Nunca se subió: alcanza con borrarla de este celular.
      await db.fotos.delete(id);
    } else {
      await db.fotos.update(id, { deletedAt: now, updatedAt: now, blob: undefined, thumbBlob: undefined });
      await enqueue('fotos', id, now);
    }
    const carpa = await db.carpas.get(foto.carpaId);
    if (carpa?.fotoPrincipalId === id) {
      const otra = (await db.fotos.where('carpaId').equals(foto.carpaId).toArray())
        .filter((f) => f.id !== id && !f.deletedAt)
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

/** Marca la foto como subida y la encola para que viaje su fila. */
export async function markFotoUploaded(id: string, url: string, thumbUrl: string): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.fotos, db.outbox, async () => {
    await db.fotos.update(id, { url, thumbUrl, updatedAt: now, uploadError: null });
    await enqueue('fotos', id, now);
  });
}
