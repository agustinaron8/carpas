# Progreso

**Estado: hitos 1 a 8 hechos y probados en local (la importación del Docs, contra la API local). Falta el deploy en la cuenta nueva de Vercel y correr ahí la importación.**

## Bloqueado (necesita a Agustín)
1. **Deploy en la cuenta de Vercel de find-without-signal** (equipo `agustinaron8-5782`): hace falta acceso a la CLI de Vercel (o hacerlo desde el panel) para crear el proyecto, Neon y Blob, cargar `APP_PASSWORD` (ya acordada, no va en el repo) y `AUTH_SECRET`, migrar e importar. Revisar antes el consumo de la cuenta.

Decidido: las 16 revisiones del Docs sin fecha quedan con 01/01/2026.

## Hecho
- Base: Vite + React + PWA + Tailwind, API Hono en `/api`, Drizzle (Neon en producción, PGlite en desarrollo y tests), login con contraseña compartida y JWT de 180 días.
- Datos locales: Dexie con outbox. Listado con búsqueda, filtros (tipo, estado, con problemas, bajas) y selección múltiple. Detalle, alta, edición y borrado.
- Sync: push/pull al abrir, al volver la conexión, al volver a la app, cada 2 min y 1,5 s después de cada cambio. Indicador global, insignias por carpa, revisión y foto, pantalla Pendientes con Reintentar, aviso "Se subieron N cambios ✓", `storage.persist()`.
- Fotos: compresión, cola de subida, miniaturas offline, foto principal.
- Revisiones: formulario en el orden de la ficha, chips de estado, precarga de la última e "Igual que la anterior", carga en lote ("Guardar y siguiente"), edición y borrado.
- Ficha PDF: individual y masiva, con o sin precarga, 1 o 2 por hoja, QR a `/carpas/:id/revision/nueva`.
- Inventario PDF: selección, revisiones (ninguna, últimas N, todas), fotos (también las de la última revisión), problemas resaltados.
- Fotos por revisión (ej. del daño): en el formulario de revisión, en el historial y en el inventario. Se borran con la revisión.
- "Con problemas" cuenta solo Regular y Mal (o estado general Revisar/Reparar); los faltantes tienen su filtro "Con faltantes". Con el Docs: 21 con problemas y 14 con faltantes, de 33.

Probado en Chromium (390 px): login, alta con foto, revisión, ficha e inventario PDF, alta sin señal y aviso al reconectar, un segundo celular que ve todo (foto incluida) y carga en lote. Con el build de producción y sin red: la app abre, genera la ficha y abre el link del QR. 5 tests del servidor (last-write-wins, código duplicado, validación, pull incremental). JS inicial: 102 KB gzip.

- Importación del Docs (`scripts/import-docx.ts`): 33 carpas, 30 revisiones y 20 fotos, sin errores. Reporte en `scripts/data/import-report.md` (no se sube). Correrlo de nuevo no duplica.

## Falta
- Correr la importación contra producción (`--api https://… --password …` con `BLOB_READ_WRITE_TOKEN`).
- Hito 9: probar en un celular real en modo avión, Lighthouse.
- A decidir al probar la app: deslizar para actualizar, y Background Sync en Android.
