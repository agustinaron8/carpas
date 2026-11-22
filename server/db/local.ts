// Base local para desarrollo y tests. Nunca se importa desde api/.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from './client.js';
import * as schema from './schema.js';

/** PGlite con las migraciones aplicadas. Sin `dir`, queda en memoria. */
export async function createLocalDb(dir?: string): Promise<Db> {
  const db = drizzle(new PGlite(dir), { schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder: new URL('./migrations', import.meta.url).pathname });
  return db as unknown as Db;
}
