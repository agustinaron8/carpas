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

1. Importar el repo en Vercel (framework: Vite).
2. Agregar **Neon** desde el Marketplace (crea `DATABASE_URL`) y un store de **Blob** (crea `BLOB_READ_WRITE_TOKEN`).
3. Cargar `APP_PASSWORD` (la contraseña del grupo) y `AUTH_SECRET` (`openssl rand -base64 32`).
4. Crear las tablas: `DATABASE_URL=... npm run db:migrate`.

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

Cambios de esquema: editar `server/db/schema.ts`, `npm run db:generate` y `npm run db:migrate`.
