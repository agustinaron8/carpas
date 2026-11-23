import type { Carpa, Evento, Revision } from '../../shared/model';
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

/** Fotos de la carpa (sin las de revisiones), en orden. */
export async function fotosDeCarpa(carpaId: string) {
  return vivas(await db.fotos.where('carpaId').equals(carpaId).toArray())
    .filter((f) => !f.revisionId)
    .sort((a, b) => a.orden - b.orden);
}

/** Fotos de cada revisión de la carpa, por id de revisión. */
export async function fotosPorRevision(carpaId: string) {
  const map = new Map<string, Awaited<ReturnType<typeof fotosDeCarpa>>>();
  const fotos = vivas(await db.fotos.where('carpaId').equals(carpaId).toArray()).sort((a, b) => a.orden - b.orden);
  for (const f of fotos) if (f.revisionId) map.set(f.revisionId, [...(map.get(f.revisionId) ?? []), f]);
  return map;
}

/** Más nuevos primero; los que no tienen fecha, al final por nombre. */
export function compararEventos(a: Evento, b: Evento): number {
  if (a.fechaInicio && b.fechaInicio) return b.fechaInicio.localeCompare(a.fechaInicio) || a.nombre.localeCompare(b.nombre, 'es');
  if (a.fechaInicio || b.fechaInicio) return a.fechaInicio ? -1 : 1;
  return b.createdAt - a.createdAt;
}

export async function eventosVivos(): Promise<Evento[]> {
  return vivas(await db.eventos.toArray()).sort(compararEventos);
}

export async function carpasDeEvento(eventoId: string) {
  return vivas(await db.eventoCarpas.where('eventoId').equals(eventoId).toArray());
}

/** Los rangos de fecha se pisan (si a alguno le falta fecha, no se puede saber: no). */
export function sePisan(a: Evento, b: Evento): boolean {
  if (!a.fechaInicio || !b.fechaInicio) return false;
  const finA = a.fechaFin ?? a.fechaInicio;
  const finB = b.fechaFin ?? b.fechaInicio;
  return a.fechaInicio <= finB && b.fechaInicio <= finA;
}
