import { beforeEach, describe, expect, it } from 'vitest';
import { revisionVacia, type Carpa } from '../shared/model';
import type { Db } from '../server/db/client';
import { createLocalDb } from '../server/db/local';
import { pull, push } from '../server/sync';

const carpa = (over: Partial<Carpa> = {}): Carpa => ({
  id: crypto.randomUUID(),
  codigo: 'C-01',
  nombre: 'Nahuel 23',
  tipo: 'canadiense',
  capacidad: 6,
  estadoGeneral: 'lista',
  notas: null,
  fotoPrincipalId: null,
  createdAt: 1000,
  updatedAt: 1000,
  deletedAt: null,
  ...over,
});

let db: Db;
beforeEach(async () => {
  db = await createLocalDb();
});

describe('push/pull', () => {
  it('inserta y devuelve en el pull', async () => {
    const c = carpa();
    const r = await push(db, [{ entidad: 'carpas', row: c as never }]);
    expect(r).toEqual([{ entidad: 'carpas', id: c.id, ok: true }]);
    const p = await pull(db, 0);
    expect(p.carpas).toEqual([c]);
    expect(p.cursor).toBeGreaterThan(0);
  });

  it('last-write-wins: ignora una versión más vieja y devuelve la actual', async () => {
    const c = carpa({ updatedAt: 2000, nombre: 'Nueva' });
    await push(db, [{ entidad: 'carpas', row: c as never }]);
    const [r] = await push(db, [{ entidad: 'carpas', row: { ...c, updatedAt: 1500, nombre: 'Vieja' } as never }]);
    expect(r.ok && r.current && (r.current as Carpa).nombre).toBe('Nueva');
    await push(db, [{ entidad: 'carpas', row: { ...c, updatedAt: 3000, nombre: 'Más nueva' } as never }]);
    expect((await pull(db, 0)).carpas[0].nombre).toBe('Más nueva');
  });

  it('rechaza código duplicado entre carpas vivas, pero no si la otra está borrada', async () => {
    await push(db, [{ entidad: 'carpas', row: carpa() as never }]);
    const [dup] = await push(db, [{ entidad: 'carpas', row: carpa() as never }]);
    expect(dup.ok).toBe(false);
    const borrada = carpa({ codigo: 'C-02', deletedAt: 5 });
    await push(db, [{ entidad: 'carpas', row: borrada as never }]);
    const [ok] = await push(db, [{ entidad: 'carpas', row: carpa({ codigo: 'C-02' }) as never }]);
    expect(ok.ok).toBe(true);
  });

  it('valida los datos y guarda revisiones', async () => {
    const c = carpa();
    const rev = { ...revisionVacia(c.id, crypto.randomUUID(), 1000, '2026-11-19'), cuerpoEstado: 'mal', cuerpoNota: 'rota' };
    const res = await push(db, [
      { entidad: 'revisiones', row: rev as never },
      { entidad: 'carpas', row: c as never },
      { entidad: 'revisiones', row: { ...rev, id: crypto.randomUUID(), cuerpoEstado: 'roto' } as never },
    ]);
    expect(res.map((x) => x.ok)).toEqual([true, true, false]);
    expect((await pull(db, 0)).revisiones[0]).toEqual(rev);
  });

  it('el pull incremental trae solo lo nuevo (con margen)', async () => {
    await push(db, [{ entidad: 'carpas', row: carpa() as never }]);
    const { cursor } = await pull(db, 0);
    const lejos = await pull(db, cursor + 10 * 60_000);
    expect(lejos.carpas).toHaveLength(0);
    const cerca = await pull(db, cursor);
    expect(cerca.carpas).toHaveLength(1);
  });
});
