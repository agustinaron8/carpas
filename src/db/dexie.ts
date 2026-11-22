// IndexedDB: fuente de verdad de la UI. Cada escritura deja una entrada en `outbox`.
import Dexie, { type EntityTable } from 'dexie';
import type { Carpa, Entidad, Foto, Revision } from '../../shared/model';

/** Foto local: `url` y `thumbUrl` quedan vacíos hasta que se sube a Blob. */
export interface LocalFoto extends Foto {
  blob?: Blob;
  thumbBlob?: Blob;
  uploadError?: string | null;
}

export interface OutboxEntry {
  /** `${entidad}:${id}`: una sola entrada por registro, la última escritura pisa a la anterior. */
  key: string;
  entidad: Entidad;
  entityId: string;
  updatedAt: number;
  error?: string | null;
  attempts?: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const db = new Dexie('carpas') as Dexie & {
  carpas: EntityTable<Carpa, 'id'>;
  fotos: EntityTable<LocalFoto, 'id'>;
  revisiones: EntityTable<Revision, 'id'>;
  outbox: EntityTable<OutboxEntry, 'key'>;
  meta: EntityTable<Meta, 'key'>;
};

db.version(1).stores({
  carpas: 'id, codigo, updatedAt',
  fotos: 'id, carpaId, url',
  revisiones: 'id, carpaId, [carpaId+fecha]',
  outbox: 'key, entidad, entityId',
  meta: 'key',
});

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export function setMeta(key: string, value: unknown): Promise<string> {
  return db.meta.put({ key, value });
}
