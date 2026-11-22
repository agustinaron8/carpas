import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';

export interface PendingInfo {
  /** Motivo del error, si el último intento falló. */
  error: string | null;
}

export interface PendingState {
  byId: Map<string, PendingInfo>;
  /** Pendientes agrupados por carpa (la carpa, sus fotos y sus revisiones). */
  byCarpa: Map<string, { count: number; error: string | null }>;
  total: number;
  errors: number;
}

const EMPTY: PendingState = { byId: new Map(), byCarpa: new Map(), total: 0, errors: 0 };

export function usePending(): PendingState {
  return (
    useLiveQuery(async () => {
      const [outbox, fotosSinSubir] = await Promise.all([
        db.outbox.toArray(),
        db.fotos.where('url').equals('').toArray(),
      ]);
      const byId = new Map<string, PendingInfo>();
      const byCarpa = new Map<string, { count: number; error: string | null }>();
      const add = (carpaId: string | undefined, error: string | null) => {
        if (!carpaId) return;
        const cur = byCarpa.get(carpaId) ?? { count: 0, error: null };
        byCarpa.set(carpaId, { count: cur.count + 1, error: cur.error ?? error });
      };
      const revIds = outbox.filter((e) => e.entidad === 'revisiones').map((e) => e.entityId);
      const fotoIds = outbox.filter((e) => e.entidad === 'fotos').map((e) => e.entityId);
      const [revs, fotos] = await Promise.all([db.revisiones.bulkGet(revIds), db.fotos.bulkGet(fotoIds)]);
      const carpaDe = new Map<string, string>();
      for (const r of revs) if (r) carpaDe.set(r.id, r.carpaId);
      for (const f of fotos) if (f) carpaDe.set(f.id, f.carpaId);
      for (const e of outbox) {
        byId.set(e.entityId, { error: e.error ?? null });
        add(e.entidad === 'carpas' ? e.entityId : carpaDe.get(e.entityId), e.error ?? null);
      }
      for (const f of fotosSinSubir) {
        if (f.deletedAt) continue;
        byId.set(f.id, { error: f.uploadError ?? null });
        add(f.carpaId, f.uploadError ?? null);
      }
      const all = [...byId.values()];
      return { byId, byCarpa, total: all.length, errors: all.filter((p) => p.error).length };
    }) ?? EMPTY
  );
}
