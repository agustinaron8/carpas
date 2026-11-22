// Esquema de Postgres. Las columnas se nombran en snake_case (casing de Drizzle).
import { sql } from 'drizzle-orm';
import { bigint, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { ESTADOS, ESTADOS_GENERALES, TIPOS } from '../../shared/model.js';

const ms = (name?: string) => (name ? bigint(name, { mode: 'number' }) : bigint({ mode: 'number' }));

// Hora del servidor en ms. Es el cursor del pull: no depende del reloj de cada celular.
export const serverNow = sql`(extract(epoch from clock_timestamp()) * 1000)::bigint`;

const auditable = {
  id: uuid().primaryKey(),
  createdAt: ms().notNull(),
  updatedAt: ms().notNull(),
  deletedAt: ms(),
  serverUpdatedAt: ms().notNull().default(serverNow),
};

export const carpas = pgTable(
  'carpas',
  {
    ...auditable,
    codigo: text().notNull(),
    nombre: text().notNull(),
    tipo: text({ enum: TIPOS }).notNull(),
    capacidad: integer(),
    estadoGeneral: text({ enum: ESTADOS_GENERALES }).notNull(),
    notas: text(),
    fotoPrincipalId: uuid(),
  },
  (t) => [
    uniqueIndex('carpas_codigo_vivo').on(t.codigo).where(sql`${t.deletedAt} is null`),
    index('carpas_sync').on(t.serverUpdatedAt),
  ],
);

export const fotos = pgTable(
  'fotos',
  {
    ...auditable,
    carpaId: uuid().notNull(),
    revisionId: uuid(),
    url: text().notNull(),
    thumbUrl: text().notNull(),
    orden: integer().notNull().default(0),
  },
  (t) => [index('fotos_carpa').on(t.carpaId), index('fotos_sync').on(t.serverUpdatedAt)],
);

const estado = () => text({ enum: ESTADOS });

export const revisiones = pgTable(
  'revisiones',
  {
    ...auditable,
    carpaId: uuid().notNull(),
    fecha: text().notNull(),
    bolsaEstado: estado(),
    bolsaNota: text(),
    cuerpoEstado: estado(),
    cuerpoNota: text(),
    cierresEstado: estado(),
    cierresNota: text(),
    parantesEstado: estado(),
    parantesNota: text(),
    estacasCantidad: integer(),
    estacasEstado: estado(),
    estacasNota: text(),
    vientosEstado: estado(),
    vientosNota: text(),
    sobretechoEstado: estado(),
    sobretechoNota: text(),
    cantidadPersonas: text(),
    tribu: text(),
    dirigenteTribu: text(),
    dirigenteComision: text(),
    observaciones: text(),
    campa: text(),
  },
  (t) => [index('revisiones_carpa').on(t.carpaId, t.fecha), index('revisiones_sync').on(t.serverUpdatedAt)],
);

export const tables = { carpas, fotos, revisiones } as const;
