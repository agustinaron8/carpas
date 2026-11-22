import { describe, expect, it } from 'vitest';
import { campoDe, cantidadEstacas, clasificar, dirigentes, fechaDe, limpiarNombre, normalizar, tipoDe, ultimaRevision } from '../scripts/docx/parse';

describe('importación del Docs', () => {
  it('mapea etiquetas variables', () => {
    expect(campoDe('BOLSA de estacas y de la carpa')).toBe('bolsa');
    expect(campoDe('BOLSA carpa y estaca')).toBe('bolsa');
    expect(campoDe('VIENTOS')).toBe('vientos');
    expect(campoDe('CAMPA Y TRIBU QUE LA USÓ')).toBe('campa');
    expect(campoDe('TRIBU QUELA USO')).toBe('tribu');
    expect(campoDe('FECHA DE REVISIÓN')).toBe('fecha');
  });

  it('clasifica el estado de cada componente', () => {
    expect(clasificar('bien', 'cuerpo')).toEqual({ estado: 'bien', nota: null });
    expect(clasificar('bien, tajo reparado debajo del cierre', 'cuerpo').estado).toBe('bien');
    expect(clasificar('roto', 'cierres').estado).toBe('mal');
    expect(clasificar('hay un tajo en la mosquitera, probablemente deba cambiarse', 'cuerpo').estado).toBe('mal');
    expect(clasificar('poner jabon', 'cierres').estado).toBe('regular');
    expect(clasificar('sin vientos', 'vientos').estado).toBe('falta');
    expect(clasificar('20 estacas en buen estado (faltan 5)', 'estacas')).toMatchObject({ estado: 'falta', cantidad: 20 });
    expect(clasificar('Bien 21', 'estacas')).toMatchObject({ estado: 'bien', cantidad: 21 });
    expect(clasificar('ponerle necesita 21', 'estacas')).toMatchObject({ estado: 'falta', cantidad: null });
    expect(clasificar('', 'bolsa')).toEqual({ estado: null, nota: null });
  });

  it('cuenta estacas', () => {
    expect(cantidadEstacas(normalizar('habian 19 de 21'))).toBe(19);
    expect(cantidadEstacas(normalizar('16stacas, falta 1'))).toBe(16);
    expect(cantidadEstacas(normalizar('Faltan 6'))).toBeNull();
  });

  it('lee tipo, fechas y dirigentes', () => {
    expect(tipoDe('iglu para 4')).toEqual({ tipo: 'iglu', capacidad: 4 });
    expect(tipoDe('Iglú')?.tipo).toBe('iglu');
    expect(tipoDe('')).toBeNull();
    expect(fechaDe('17/8')).toBe('2026-08-17');
    expect(fechaDe('4/10/ 2026')).toBe('2026-10-04');
    expect(dirigentes('fati v. reviso vicky')).toEqual({ tribu: 'fati v', comision: 'vicky' });
    expect(dirigentes('laucha, vicky revisó')).toEqual({ tribu: 'laucha', comision: 'vicky' });
    expect(dirigentes('maxi h y reviso karli')).toEqual({ tribu: 'maxi h', comision: 'karli' });
    expect(dirigentes('luna (observación: cande lopez)')).toEqual({ tribu: 'luna', comision: 'cande lopez' });
    expect(dirigentes('Gonza y facu')).toEqual({ tribu: 'Gonza y facu', comision: null });
  });

  it('separa la última revisión', () => {
    expect(ultimaRevision('ÚLTIMA REVISIÓN (medi): 30/7/26 se le cambiaron estacas')).toEqual({
      fecha: '2026-07-30',
      texto: 'se le cambiaron estacas',
      comision: null,
    });
    expect(ultimaRevision('ultima revisión: 4/10 cati')).toMatchObject({ fecha: '2026-10-04', texto: null, comision: 'cati' });
    expect(ultimaRevision('Ultima revisión : 30/7 impecable')).toMatchObject({ texto: 'impecable', comision: null });
  });

  it('limpia notas del nombre', () => {
    expect(limpiarNombre('Bolsa Marrón mediterráneo LISTAAA')).toEqual({ nombre: 'Bolsa Marrón mediterráneo', nota: null, estado: 'lista' });
    expect(limpiarNombre('MANGRULLO (no tenemos fotos)').nombre).toBe('Mangrullo');
    expect(limpiarNombre('Lu pacheco (klimber)').nombre).toBe('Lu pacheco (klimber)');
    expect(limpiarNombre('Tortuga 5 ( es la bolsa de tortuga 9)')).toMatchObject({ nombre: 'Tortuga 5', nota: 'Es la bolsa de tortuga 9' });
  });
});
