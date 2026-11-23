# Progreso

**Estado: publicado en https://carpas-grupo.vercel.app con los datos del Docs cargados. Falta probarlo en celulares reales.**

## Pendiente de Agustín
1. **Probar en celulares reales** (iPhone y Android): instalar en la pantalla de inicio, cargar en modo avión, volver a tener señal. Probar también cerrar sesión y volver a entrar en modo avión.
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

- Entrar sin señal en un celular que ya entró antes (también después de cerrar sesión), y renovación automática de la sesión: probados en Chromium.

Revisión de exports (22/11), en local y en producción, abriendo cada PDF y verificando su contenido: inventario (todas, solo estado actual, sin fotos, elegidas, con filtro, una carpa con todo el historial y fotos de revisión), fichas (todas, sin precarga, 2 por hoja, selección, carpa sin revisiones, textos extremos). Los QR se leen con un lector automático y llevan a la carpa correcta. Sin conexión: inventario con fotos y fichas.

- Eventos (23/11): pestaña "Eventos" junto a "Carpas". Cada evento (nombre, fechas, lugar, notas) tiene carpas del inventario asignadas y carpas prestadas solo para ese evento, con tribu, cantidad (M/V), dirigente a cargo y observaciones. De cada prestada se anota quién la presta y su tribu, y si ya se devolvió (Sí/No); se ve en el evento y en la lista de eventos ("N sin devolver"), no en el PDF. "Lista para imprimir": PDF con las del grupo y las prestadas en tablas separadas y una columna de observaciones para anotar a mano. Desde el evento también se imprimen las fichas y se exporta el inventario de sus carpas.
- Filtro por estado (Lista, Revisar, Reparar, Baja) en todos los diálogos de imprimir y exportar, con atajo "Solo las listas". Al agregar carpas a un evento arranca mostrando solo las listas.

Probado en Chromium (390 px, claro y oscuro): crear evento, agregar 7 carpas del inventario, editar dos, agregar una prestada, lista PDF (revisada a ojo), fichas del evento y pendientes. 20 tests.

- Personas sugeridas por tribu (23/11): dato fijo de cada carpa (Picunches, Sanavirones, Caminos, Comechingones, Huellas, Dirigentes), se carga en "Editar carpa" y se ve en un desplegable debajo del nombre. No cambia con las revisiones; lo vacío queda "sin cargar". En los eventos: al agregar carpas se puede elegir la tribu y cada una muestra su sugerido (y queda con esa cantidad); al editar, "Sugerido para X: N" con "Usar N"; en la lista avisa "Más de lo sugerido". También sale en el inventario PDF.

- Simulador de distribución (23/11): en cada evento, "Simular distribución por tribu". Se cargan los integrantes por tribu (mujeres y varones aparte; quedan guardados en el evento) y reparte cada grupo en las carpas del evento (propias y prestadas) según las personas sugeridas de cada carpa, sin mezclar tribus ni mujeres con varones en una carpa. Muestra cuántos van en cada carpa, si falta lugar y qué carpas sobran. "Aplicar esta distribución" escribe tribu, M/V y cantidad en las carpas del evento; se puede respetar lo ya asignado a mano.

## Falta
- Hito 9: probar en un celular real en modo avión, Lighthouse.
- A decidir al probar la app: deslizar para actualizar, y Background Sync en Android.
