import { beforeEach, describe, expect, it } from 'vitest';
import type { Carpa, Evento, EventoCarpa } from '../shared/model';
import type { Db } from '../server/db/client';
import { createLocalDb } from '../server/db/local';
import { pull, push } from '../server/sync';
import { cantidadTexto, ordenar, rangoFechas, totales } from '../src/lib/eventos';

const evento = (over: Partial<Evento> = {}): Evento => ({
  id: crypto.randomUUID(),
  nombre: 'Campamento de promesas',
  fechaInicio: '2026-12-05',
  fechaFin: '2026-12-08',
  lugar: null,
  notas: null,
  createdAt: 1000,
  updatedAt: 1000,
  deletedAt: null,
  ...over,
});

const ec = (eventoId: string, over: Partial<EventoCarpa> = {}): EventoCarpa => ({
  id: crypto.randomUUID(),
  eventoId,
  carpaId: null,
  nombre: null,
  prestadaPor: null,
  prestadaPorTribu: null,
  capacidad: null,
  devuelta: false,
  tribu: null,
  cantidad: null,
  genero: null,
  dirigente: null,
  observaciones: null,
  createdAt: 1000,
  updatedAt: 1000,
  deletedAt: null,
  ...over,
});

const carpa = (codigo: string, nombre: string, capacidad: number | null = null): Carpa => ({
  id: crypto.randomUUID(),
  codigo,
  nombre,
  tipo: 'canadiense',
  capacidad,
  estadoGeneral: 'lista',
  notas: null,
  fotoPrincipalId: null,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
});

describe('sync de eventos', () => {
  let db: Db;
  beforeEach(async () => {
    db = await createLocalDb();
  });

  it('sube y baja eventos y sus carpas (propias y prestadas)', async () => {
    const ev = evento();
    const propia = ec(ev.id, { carpaId: crypto.randomUUID(), tribu: 'Picunches', cantidad: 7, genero: 'm', dirigente: 'Bri' });
    const prestada = ec(ev.id, { nombre: 'Iglú verde', prestadaPor: 'Juan Pérez', prestadaPorTribu: 'Comechingón', capacidad: 4, devuelta: true });
    const r = await push(db, [
      { entidad: 'eventoCarpas', row: propia as never },
      { entidad: 'eventos', row: ev as never },
      { entidad: 'eventoCarpas', row: prestada as never },
    ]);
    expect(r.every((x) => x.ok)).toBe(true);
    const p = await pull(db, 0);
    expect(p.eventos).toEqual([ev]);
    expect(p.eventoCarpas).toHaveLength(2);
    expect(p.eventoCarpas.find((x) => x.id === prestada.id)).toEqual(prestada);
  });

  it('el borrado es lógico y gana la escritura más nueva', async () => {
    const ev = evento();
    await push(db, [{ entidad: 'eventos', row: ev as never }]);
    await push(db, [{ entidad: 'eventos', row: { ...ev, updatedAt: 3000, deletedAt: 3000 } as never }]);
    const [viejo] = await push(db, [{ entidad: 'eventos', row: { ...ev, updatedAt: 2000, nombre: 'Viejo' } as never }]);
    expect(viejo.ok && (viejo.current as Evento).deletedAt).toBe(3000);
    expect((await pull(db, 0)).eventos[0].deletedAt).toBe(3000);
  });

  it('rechaza datos inválidos', async () => {
    const ev = evento();
    const [r] = await push(db, [{ entidad: 'eventoCarpas', row: ec(ev.id, { genero: 'x' as never }) as never }]);
    expect(r.ok).toBe(false);
  });
});

describe('lista del evento', () => {
  const a = carpa('C-02', 'Nahuel 23', 7);
  const b = carpa('C-10', 'Flecha azul', 6);
  const carpas = new Map([a, b].map((c) => [c.id, c]));
  const ev = evento();
  const rows = [
    ec(ev.id, { carpaId: b.id, tribu: 'Sanavirón', cantidad: 6, genero: 'v' }),
    ec(ev.id, { carpaId: a.id, tribu: 'picunches', cantidad: 7, genero: 'm' }),
    ec(ev.id, { nombre: 'Iglú', capacidad: 3, cantidad: 2 }),
  ];

  it('ordena por tribu (sin tribu al final) o por carpa', () => {
    expect(ordenar(rows, carpas, 'tribu').map((r) => r.tribu)).toEqual(['picunches', 'Sanavirón', null]);
    expect(ordenar(rows.slice(0, 2), carpas, 'carpa').map((r) => r.carpaId)).toEqual([a.id, b.id]);
  });

  it('totales y textos', () => {
    expect(totales(rows, carpas)).toEqual({ carpas: 3, lugares: 16, personas: 15, m: 7, v: 6 });
    expect(cantidadTexto(rows[0])).toBe('6 V');
    expect(cantidadTexto(rows[2])).toBe('2');
    expect(rangoFechas(ev)).toBe('05/12 al 08/12/2026');
    expect(rangoFechas({ fechaInicio: '2026-12-05', fechaFin: null })).toBe('05/12/2026');
  });
});
