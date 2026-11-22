// En Vercel usa Neon por HTTP. En desarrollo y tests, `setDb` inyecta PGlite (ver local.ts).
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL');
    db = drizzle(neon(url), { schema, casing: 'snake_case' }) as unknown as Db;
  }
  return db;
}

export function setDb(value: Db): void {
  db = value;
}
