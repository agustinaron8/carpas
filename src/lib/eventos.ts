// Utilidades de eventos que usan las pantallas y el PDF de la lista.
import type { Carpa, Evento, EventoCarpa } from '../../shared/model';
import { fechaCorta } from './format';

export function esPrestada(ec: EventoCarpa): boolean {
  return !ec.carpaId;
}

/** Nombre para mostrar: el de la carpa del inventario o el que se le puso a la prestada. */
export function nombreDe(ec: EventoCarpa, carpas: Map<string, Carpa>): string {
  if (ec.carpaId) return carpas.get(ec.carpaId)?.nombre ?? 'Carpa borrada';
  return ec.nombre || 'Prestada sin nombre';
}

export function capacidadDe(ec: EventoCarpa, carpas: Map<string, Carpa>): number | null {
  return ec.carpaId ? (carpas.get(ec.carpaId)?.capacidad ?? null) : ec.capacidad;
}

/** "7 M", "6 V", "4" o "". Como en la lista en papel. */
export function cantidadTexto(ec: EventoCarpa): string {
  return [ec.cantidad ?? '', ec.genero?.toUpperCase() ?? ''].join(' ').trim();
}

export type OrdenLista = 'tribu' | 'carpa';

export function ordenar(rows: EventoCarpa[], carpas: Map<string, Carpa>, orden: OrdenLista): EventoCarpa[] {
  const porCarpa = (a: EventoCarpa, b: EventoCarpa) => {
    const ca = a.carpaId ? carpas.get(a.carpaId) : undefined;
    const cb = b.carpaId ? carpas.get(b.carpaId) : undefined;
    if (ca && cb) return ca.codigo.localeCompare(cb.codigo, 'es', { numeric: true });
    return nombreDe(a, carpas).localeCompare(nombreDe(b, carpas), 'es', { numeric: true });
  };
  return [...rows].sort((a, b) => {
    if (orden === 'tribu') {
      // Las que no tienen tribu, al final.
      const ta = a.tribu?.trim() ?? '';
      const tb = b.tribu?.trim() ?? '';
      if (ta !== tb) return !ta ? 1 : !tb ? -1 : ta.localeCompare(tb, 'es', { sensitivity: 'base' });
    }
    return porCarpa(a, b);
  });
}

/** "05/12 al 08/12/2026", "05/12/2026" o "". */
export function rangoFechas(ev: Pick<Evento, 'fechaInicio' | 'fechaFin'>): string {
  const { fechaInicio: i, fechaFin: f } = ev;
  if (!i) return f ? `hasta el ${fechaCorta(f)}` : '';
  if (!f || f === i) return fechaCorta(i);
  if (i.slice(0, 4) === f.slice(0, 4)) return `${fechaCorta(i).slice(0, 5)} al ${fechaCorta(f)}`;
  return `${fechaCorta(i)} al ${fechaCorta(f)}`;
}

export interface Totales {
  carpas: number;
  lugares: number;
  personas: number;
  m: number;
  v: number;
}

export function totales(rows: EventoCarpa[], carpas: Map<string, Carpa>): Totales {
  const t: Totales = { carpas: rows.length, lugares: 0, personas: 0, m: 0, v: 0 };
  for (const ec of rows) {
    t.lugares += capacidadDe(ec, carpas) ?? 0;
    t.personas += ec.cantidad ?? 0;
    if (ec.genero === 'm') t.m += ec.cantidad ?? 0;
    if (ec.genero === 'v') t.v += ec.cantidad ?? 0;
  }
  return t;
}
