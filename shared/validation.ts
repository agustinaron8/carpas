// Validación de lo que llega al servidor. El cliente no la importa, así no carga Zod.
import { z } from 'zod';
import type { Entidad } from './model.js';
import { CAMPOS_TEXTO, COMPONENTES, ENTIDADES, ESTADOS, ESTADOS_GENERALES, GENEROS, TIPOS } from './model.js';

const ts = z.number().int().nonnegative();
const texto = (max: number) => z.string().max(max).nullable();

const auditable = {
  id: z.string().uuid(),
  createdAt: ts,
  updatedAt: ts,
  deletedAt: ts.nullable(),
};

const componentes = Object.fromEntries(
  COMPONENTES.flatMap((c) => [
    [`${c.key}Estado`, z.enum(ESTADOS).nullable()],
    [`${c.key}Nota`, texto(1000)],
  ]),
);

export const carpaSchema = z.object({
  ...auditable,
  codigo: z.string().trim().min(1).max(20),
  nombre: z.string().trim().min(1).max(120),
  tipo: z.enum(TIPOS),
  capacidad: z.number().int().min(0).max(1000).nullable(),
  estadoGeneral: z.enum(ESTADOS_GENERALES),
  notas: texto(4000),
  fotoPrincipalId: z.string().uuid().nullable(),
  // Opcionales: un celular con la versión anterior no los manda, y entonces no se tocan (ver sync.ts).
  estadoActual: z.object(componentes).extend({ estacasCantidad: z.number().int().min(0).max(500).nullable() }).nullable().optional(),
  estadoActualEn: ts.nullable().optional(),
});

export const fotoSchema = z.object({
  ...auditable,
  carpaId: z.string().uuid(),
  // Los clientes anteriores no lo mandan.
  revisionId: z.string().uuid().nullable().default(null),
  url: z.string().url().max(1000),
  thumbUrl: z.string().url().max(1000),
  orden: z.number().int(),
});

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

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const eventoSchema = z.object({
  ...auditable,
  nombre: z.string().trim().min(1).max(120),
  fechaInicio: fecha.nullable(),
  fechaFin: fecha.nullable(),
  lugar: texto(200),
  notas: texto(4000),
});

export const eventoCarpaSchema = z.object({
  ...auditable,
  eventoId: z.string().uuid(),
  carpaId: z.string().uuid().nullable(),
  nombre: texto(120),
  prestadaPor: texto(120),
  capacidad: z.number().int().min(0).max(1000).nullable(),
  devuelta: z.boolean(),
  tribu: texto(120),
  cantidad: z.number().int().min(0).max(1000).nullable(),
  genero: z.enum(GENEROS).nullable(),
  dirigente: texto(200),
  observaciones: texto(2000),
});

export const schemas = {
  carpas: carpaSchema,
  fotos: fotoSchema,
  revisiones: revisionSchema,
  eventos: eventoSchema,
  eventoCarpas: eventoCarpaSchema,
} as const;

export const pushBodySchema = z.object({
  items: z
    .array(z.object({ entidad: z.enum(ENTIDADES as [Entidad, ...Entidad[]]), row: z.record(z.unknown()) }))
    .max(500),
});
