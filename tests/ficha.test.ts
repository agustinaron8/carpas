import { describe, expect, it } from 'vitest';
import { ajustarTexto, lineasDe } from '../src/pdf/ajustar';

describe('ficha: el texto entra en la celda', () => {
  it('cuenta líneas cortando en espacios', () => {
    expect(lineasDe('', 10)).toBe(1);
    expect(lineasDe('hola chau', 10)).toBe(1);
    expect(lineasDe('hola chau que tal', 10)).toBe(2);
    expect(lineasDe('a\nb', 10)).toBe(2);
    expect(lineasDe('x'.repeat(25), 10)).toBe(3);
  });

  it('deja el texto corto como está y achica o corta el largo', () => {
    expect(ajustarTexto('Bien', 199, 29, [9, 8, 7])).toEqual({ text: 'Bien', fontSize: 9 });
    const medio = ajustarTexto('palabra '.repeat(14).trim(), 199, 29, [9, 8, 7]);
    expect(medio.fontSize).toBeLessThan(9);
    expect(medio.text).not.toContain('…');
    const largo = ajustarTexto('palabra '.repeat(200).trim(), 199, 29, [9, 8, 7]);
    expect(largo.fontSize).toBe(7);
    expect(largo.text.endsWith('…')).toBe(true);
    expect(largo.text.length).toBeLessThan(200);
  });
});
