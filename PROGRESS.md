# Progreso

**Estado: hitos 1 a 7 del plan hechos y probados en local. Falta el deploy (cuenta nueva de Vercel) y la importación del Docs.**

## Bloqueado (necesita a Agustín)
1. **Cuenta de Vercel nueva**: con acceso, se crean Neon y Blob, se cargan `APP_PASSWORD` y `AUTH_SECRET`, se migra y se despliega.
2. **El Docs "Carpas 2026" (.docx)** y el **PDF de ejemplo** a exportar: la base tiene que arrancar con todos esos datos (hito 8).

## Hecho
- Base: Vite + React + PWA + Tailwind, API Hono en `/api`, Drizzle (Neon en producción, PGlite en desarrollo y tests), login con contraseña compartida y JWT de 180 días.
- Datos locales: Dexie con outbox. Listado con búsqueda, filtros (tipo, estado, con problemas, bajas) y selección múltiple. Detalle, alta, edición y borrado.
- Sync: push/pull al abrir, al volver la conexión, al volver a la app, cada 2 min y 1,5 s después de cada cambio. Indicador global, insignias por carpa, revisión y foto, pantalla Pendientes con Reintentar, aviso "Se subieron N cambios ✓", `storage.persist()`.
- Fotos: compresión, cola de subida, miniaturas offline, foto principal.
- Revisiones: formulario en el orden de la ficha, chips de estado, precarga de la última e "Igual que la anterior", carga en lote ("Guardar y siguiente"), edición y borrado.
- Ficha PDF: individual y masiva, con o sin precarga, 1 o 2 por hoja, QR a `/carpas/:id/revision/nueva`.
- Inventario PDF: selección, revisiones (ninguna, últimas N, todas), fotos, problemas resaltados.

Probado en Chromium (390 px): login, alta con foto, revisión, ficha e inventario PDF, alta sin señal y aviso al reconectar, un segundo celular que ve todo (foto incluida) y carga en lote. Con el build de producción y sin red: la app abre, genera la ficha y abre el link del QR. 5 tests del servidor (last-write-wins, código duplicado, validación, pull incremental). JS inicial: 102 KB gzip.

## Falta
- Hito 8: `scripts/import-docx.ts` con el Docs real.
- Hito 9: probar en un celular real en modo avión, Lighthouse.
- Pull-to-refresh con gesto (hoy hay un botón de actualizar en el listado).
- Background Sync (opcional, solo Android).
