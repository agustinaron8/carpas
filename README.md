# Carpas

App web (PWA) para gestionar las carpas del grupo: alta, baja y edición con fotos, historial de revisiones, inventario en PDF y fichas de revisión para imprimir. Reemplaza el documento "Carpas 2026". Funciona sin señal: todo se guarda en el celular y se sube cuando vuelve la conexión.

El plan completo está en `PLAN.md`, las decisiones en `DECISIONS.md` y el avance en `PROGRESS.md`.

## Cómo correrlo

Requiere Node 20 o superior (con Node 18 los scripts ya pasan `--experimental-global-webcrypto`).

```bash
npm install
npm run dev        # web en :5173 y API en :8787 (PGlite en .pglite/, fotos en disco)
npm test           # tests del servidor (sync) sobre PGlite
npm run lint
npm run build
```

En desarrollo la contraseña es `carpas` (se cambia en `.env.local`, ver `.env.example`). No hace falta Postgres ni Vercel: la API local usa PGlite y guarda las fotos en `.pglite/blobs`.

## Despliegue (Vercel)

Publicado en https://carpas-grupo.vercel.app (proyecto `carpas` del equipo `agustinaron8-5782`). Funciones, base (Neon) y fotos (Blob) en São Paulo (`gru1`).

Cómo se armó, por si hay que repetirlo:
1. `vercel link`, y conectar el repo.
2. `vercel storage create carpas-fotos --type blob --access public --region gru1` y `vercel storage connect` (credenciales OIDC: `BLOB_STORE_ID`; también anda con `BLOB_READ_WRITE_TOKEN`).
3. `vercel integration add neon --meta region=gru1` (crea `DATABASE_URL`).
4. `APP_PASSWORD` (la contraseña del grupo) y `AUTH_SECRET` (`openssl rand -base64 48`) como variables sensibles.
5. `vercel env pull .env.production.local --environment production` y crear las tablas: `node --env-file=.env.production.local --import tsx scripts/migrate.ts` (Node 20+).
6. Carga inicial desde el Docs (el .docx en `scripts/data/Carpas-2026.docx`):
   `node --env-file=.env.production.local --import tsx scripts/import-docx.ts --api https://carpas-grupo.vercel.app --password <clave>`.
   Con `--dry-run` solo escribe el reporte en `scripts/data/import-report.md`. Después, borrar `.env.production.local`.

Cada push a `main` despliega. `vercel.json` manda `/api/*` a la única función (`api/index.ts`, Hono) y el resto a `index.html`.

## Arquitectura

| Parte | Dónde | Qué hace |
|---|---|---|
| Modelo | `shared/model.ts` | Tipos y orden de las filas de la ficha, compartidos con el servidor |
| Datos locales | `src/db/` | Dexie. La UI solo lee y escribe acá; cada escritura deja una entrada en `outbox` |
| Sync | `src/sync/syncService.ts` | Sube el outbox, baja los cambios y lleva el estado del indicador |
| Fotos | `src/sync/fotos.ts` | Comprime (1600 px y miniatura de 400 px), guarda en el celular y sube a Blob |
| API | `server/app.ts` | Login, `sync/push`, `sync/pull`, token para subir a Blob |
| Base | `server/db/` | Drizzle + Neon. Last-write-wins por `updatedAt`; el pull usa la hora del servidor |
| PDFs | `src/pdf/` | pdfmake, carga perezosa. Ficha de revisión e inventario, generados en el celular |
| Service worker | `src/sw.ts` | Precache de la app (incluido pdfmake) y cache-first para las fotos |

## Recuperar algo borrado

Nada se borra del todo: carpas, revisiones y fotos quedan en la base con `deleted_at`, y los archivos de las fotos siguen en Blob. Para recuperar algo, en la consola SQL de Neon (Vercel → Storage → carpas-db → Open in Neon):

```sql
-- Ver lo borrado
SELECT id, codigo, nombre, to_timestamp(deleted_at / 1000) AS borrada FROM carpas WHERE deleted_at IS NOT NULL;
SELECT r.id, c.nombre, r.fecha, to_timestamp(r.deleted_at / 1000) AS borrada
  FROM revisiones r JOIN carpas c ON c.id = r.carpa_id WHERE r.deleted_at IS NOT NULL;

-- Restaurar (cambiar la tabla y el id). Hay que actualizar las dos fechas para que los celulares lo bajen.
UPDATE carpas SET deleted_at = NULL,
  updated_at = (extract(epoch from now()) * 1000)::bigint,
  server_updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
WHERE id = '...';
```

Al restaurar una revisión, restaurar también sus fotos (`fotos.revision_id`). Una carpa con el mismo código que otra viva no se puede restaurar hasta cambiarle el código.

Cambios de esquema: editar `server/db/schema.ts`, `npm run db:generate` y `npm run db:migrate`.
