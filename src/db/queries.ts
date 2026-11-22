import type { Carpa, Revision } from '../../shared/model';
import { db } from './dexie';

export const vivas = <T extends { deletedAt: number | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export function ordenarRevisiones(revs: Revision[]): Revision[] {
  return [...revs].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.createdAt - a.createdAt);
}

export async function revisionesDe(carpaId: string): Promise<Revision[]> {
  return ordenarRevisiones(vivas(await db.revisiones.where('carpaId').equals(carpaId).toArray()));
}

export async function ultimaRevision(carpaId: string): Promise<Revision | undefined> {
  return (await revisionesDe(carpaId))[0];
}

/** Última revisión de cada carpa, en una sola lectura. */
export async function ultimasRevisiones(): Promise<Map<string, Revision>> {
  const map = new Map<string, Revision>();
  for (const r of ordenarRevisiones(vivas(await db.revisiones.toArray()))) {
    if (!map.has(r.carpaId)) map.set(r.carpaId, r);
  }
  return map;
}

export async function carpasVivas(): Promise<Carpa[]> {
  return vivas(await db.carpas.toArray()).sort(compararCodigo);
}

export function compararCodigo(a: Carpa, b: Carpa): number {
  return a.codigo.localeCompare(b.codigo, 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre, 'es');
}

/** Siguiente código libre con el formato `C-NN`. */
export function sugerirCodigo(carpas: Carpa[]): string {
  const usados = new Set(carpas.map((c) => c.codigo.toUpperCase()));
  for (let n = 1; ; n++) {
    const codigo = `C-${String(n).padStart(2, '0')}`;
    if (!usados.has(codigo)) return codigo;
  }
}
