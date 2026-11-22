// Push con last-write-wins por `updatedAt` y pull por la hora del servidor.
import { gt, sql } from 'drizzle-orm';
import type { Entidad, EntityMap, PullResponse, PushResult } from '../shared/model.js';
import { ENTIDADES } from '../shared/model.js';
import { schemas } from '../shared/validation.js';
import type { Db } from './db/client.js';
import { serverNow, tables } from './db/schema.js';

/**
 * El pull vuelve a mirar este margen hacia atrás del cursor, por si una escritura que empezó antes
 * terminó después del pull anterior. Aplicar una fila repetida no cambia nada.
 */
export const PULL_OVERLAP_MS = 60_000;

const ORDEN: Record<Entidad, number> = { carpas: 0, fotos: 1, revisiones: 2 };

function strip<T extends { serverUpdatedAt?: unknown }>(row: T): Omit<T, 'serverUpdatedAt'> {
  const { serverUpdatedAt: _omit, ...rest } = row;
  void _omit;
  return rest;
}

function pgCode(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 3 && e && typeof e === 'object'; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export async function push(
  db: Db,
  items: { entidad: Entidad; row: Record<string, unknown> }[],
  onFotoBorrada?: (foto: EntityMap['fotos']) => Promise<void>,
): Promise<PushResult[]> {
  const ordered = [...items].sort((a, b) => ORDEN[a.entidad] - ORDEN[b.entidad]);
  const results: PushResult[] = [];
  for (const { entidad, row: raw } of ordered) {
    const id = typeof raw.id === 'string' ? raw.id : '';
    const parsed = schemas[entidad].safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      results.push({ entidad, id, ok: false, error: `Datos inválidos (${issue.path.join('.')}: ${issue.message})` });
      continue;
    }
    const row = parsed.data as EntityMap[typeof entidad];
    const table = tables[entidad];
    try {
      const { id: _id, ...rest } = row;
      void _id;
      const written = await db
        .insert(table)
        .values({ ...row, serverUpdatedAt: serverNow } as never)
        .onConflictDoUpdate({
          target: table.id,
          set: { ...rest, serverUpdatedAt: serverNow } as never,
          setWhere: sql`${table.updatedAt} < ${row.updatedAt}`,
        })
        .returning({ id: table.id });
      if (written.length === 0) {
        const [current] = await db.select().from(table).where(sql`${table.id} = ${row.id}`);
        results.push({ entidad, id: row.id, ok: true, current: current ? (strip(current) as never) : undefined });
      } else {
        results.push({ entidad, id: row.id, ok: true });
        if (entidad === 'fotos' && row.deletedAt && onFotoBorrada) {
          await onFotoBorrada(row as EntityMap['fotos']).catch(() => undefined);
        }
      }
    } catch (err) {
      if (pgCode(err) === '23505' && entidad === 'carpas') {
        const codigo = (row as EntityMap['carpas']).codigo;
        results.push({ entidad, id: row.id, ok: false, error: `Ya hay otra carpa con el código ${codigo}. Cambiá el código.` });
      } else {
        console.error('push', entidad, row.id, err);
        results.push({ entidad, id: row.id, ok: false, error: 'Error del servidor al guardar' });
      }
    }
  }
  return results;
}

export async function pull(db: Db, since: number): Promise<PullResponse> {
  const result = (await db.execute(sql`select ${serverNow} as now`)) as unknown as { rows: { now: string | number }[] };
  const now = result.rows[0].now;
  const desde = Math.max(0, since - PULL_OVERLAP_MS);
  const out = { cursor: Number(now) } as PullResponse;
  for (const entidad of ENTIDADES) {
    const table = tables[entidad];
    const rows = since > 0 ? await db.select().from(table).where(gt(table.serverUpdatedAt, desde)) : await db.select().from(table);
    (out[entidad] as unknown[]) = rows.map(strip);
  }
  return out;
}
