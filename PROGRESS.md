# Progreso

**Estado: publicado en https://carpas-grupo.vercel.app con los datos del Docs cargados. Falta probarlo en celulares reales.**

## Pendiente de Agustín
1. **Probar en celulares reales** (iPhone y Android): instalar en la pantalla de inicio, cargar en modo avión, volver a tener señal.
2. Que alguien del grupo revise `scripts/data/import-report.md` (cómo se interpretó cada campo del Docs).

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

En producción (22/11): login, 33 carpas con fotos, revisión con foto subida desde el navegador, borrado de la foto en Blob al borrar la revisión, y apertura sin red con el service worker.

## Falta
- Hito 9: probar en un celular real en modo avión, Lighthouse.
- A decidir al probar la app: deslizar para actualizar, y Background Sync en Android.
