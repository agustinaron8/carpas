// Validación de lo que llega al servidor. El cliente no la importa, así no carga Zod.
import { z } from 'zod';
import { CAMPOS_TEXTO, COMPONENTES, ESTADOS, ESTADOS_GENERALES, TIPOS } from './model.js';

const ts = z.number().int().nonnegative();
const texto = (max: number) => z.string().max(max).nullable();

const auditable = {
  id: z.string().uuid(),
  createdAt: ts,
  updatedAt: ts,
  deletedAt: ts.nullable(),
};

export const carpaSchema = z.object({
  ...auditable,
  codigo: z.string().trim().min(1).max(20),
  nombre: z.string().trim().min(1).max(120),
  tipo: z.enum(TIPOS),
  capacidad: z.number().int().min(0).max(1000).nullable(),
  estadoGeneral: z.enum(ESTADOS_GENERALES),
  notas: texto(4000),
  fotoPrincipalId: z.string().uuid().nullable(),
});

export const fotoSchema = z.object({
  ...auditable,
  carpaId: z.string().uuid(),
  url: z.string().url().max(1000),
  thumbUrl: z.string().url().max(1000),
  orden: z.number().int(),
});

const componentes = Object.fromEntries(
  COMPONENTES.flatMap((c) => [
    [`${c.key}Estado`, z.enum(ESTADOS).nullable()],
    [`${c.key}Nota`, texto(1000)],
  ]),
);
const textos = Object.fromEntries(CAMPOS_TEXTO.map((t) => [t.key, texto(4000)]));

export const revisionSchema = z.object({
  ...auditable,
  ...componentes,
  ...textos,
  carpaId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estacasCantidad: z.number().int().min(0).max(500).nullable(),
  campa: texto(200),
});

export const schemas = { carpas: carpaSchema, fotos: fotoSchema, revisiones: revisionSchema } as const;

export const pushBodySchema = z.object({
  items: z
    .array(z.object({ entidad: z.enum(['carpas', 'fotos', 'revisiones']), row: z.record(z.unknown()) }))
    .max(500),
});
