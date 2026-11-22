// Aplica las migraciones en Neon: DATABASE_URL=... npm run db:migrate
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}
await migrate(drizzle(neon(url)), { migrationsFolder: 'server/db/migrations' });
console.log('Migraciones aplicadas');
