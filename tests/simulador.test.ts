import { describe, expect, it } from 'vitest';
import { repartir, simular, type CarpaSim } from '../src/lib/simulador';

const carpa = (id: string, cap: CarpaSim['cap'], fija?: CarpaSim['fija']): CarpaSim => ({ id, nombre: id, cap, estimado: [], fija });

describe('simulador', () => {
  it('reparte parejo sin pasar el lugar', () => {
    expect(repartir(10, [7, 7])).toEqual([5, 5]);
    expect(repartir(9, [8, 4])).toEqual([6, 3]);
    expect(repartir(20, [5, 5])).toEqual([5, 5]);
  });

  it('separa mujeres y varones y no mezcla tribus en una carpa', () => {
    const carpas = [carpa('a', { picunches: 8, huellas: 4 }), carpa('b', { picunches: 7, huellas: 4 }), carpa('c', { picunches: 6, huellas: 3 }), carpa('d', { huellas: 5 })];
    const r = simular({ picunches: { m: 7, v: 6 }, huellas: { m: 4, v: 0 } }, carpas);
    expect(r.faltanTotal).toBe(0);
    const ids = r.grupos.flatMap((g) => g.carpas.map((u) => u.carpaId));
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of r.grupos) expect(g.carpas.reduce((s, u) => s + u.cantidad, 0)).toBe(g.n);
    // Usa la carpa justa: 7 picunches mujeres en la de 7, 6 varones en la de 6, 4 huellas en una de 4.
    const de = (t: string, gen: string) => r.grupos.find((g) => g.tribu === t && g.genero === gen)!.carpas.map((u) => u.carpaId);
    expect(de('picunches', 'm')).toEqual(['b']);
    expect(de('picunches', 'v')).toEqual(['c']);
    expect(r.sobran).toHaveLength(1);
  });

  it('avisa cuántos no entran', () => {
    const r = simular({ caminos: { m: 10, v: 0 } }, [carpa('a', { caminos: 6 }), carpa('b', { picunches: 8 })]);
    expect(r.faltanTotal).toBe(4);
    expect(r.grupos[0].carpas).toEqual([{ carpaId: 'a', cantidad: 6, cap: 6, fija: false }]);
    expect(r.sobran).toEqual(['b']);
  });

  it('respeta las asignadas a mano y descuenta del grupo', () => {
    const r = simular({ sanavirones: { m: 0, v: 10 } }, [
      carpa('a', { sanavirones: 6 }, { tribu: 'sanavirones', genero: 'v', cantidad: 6 }),
      carpa('b', { sanavirones: 4 }),
      carpa('c', { sanavirones: 7 }),
    ]);
    const g = r.grupos[0];
    expect(g.faltan).toBe(0);
    expect(g.carpas).toEqual([
      { carpaId: 'a', cantidad: 6, cap: 6, fija: true },
      { carpaId: 'b', cantidad: 4, cap: 4, fija: false },
    ]);
  });
});
