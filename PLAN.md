# Carpas — Plan de proyecto

App web para gestionar las carpas del grupo: ABM, registro de revisiones, exportación de inventario a PDF y generación de fichas de revisión para imprimir. Reemplaza el documento "Carpas 2026" (.docx).

## Requisitos

1. **ABM de carpas** con foto(s).
2. **Revisiones**: historial por carpa. Se hacen a mano en papel (ficha) y después se cargan en la app.
3. **Exportar PDF de inventario**: todas las carpas o una selección, con sus atributos y, opcionalmente, sus revisiones.
4. **Generar ficha de revisión** (PDF imprimible): un botón en cada carpa y un botón general (todas o seleccionadas).
   - La ficha tiene 2 columnas en blanco. Opción **"Precargar última revisión"**: la columna 1 sale completa con la última revisión y la columna 2 queda en blanco para la revisión nueva.
5. **Liviana y usable con poca o ninguna señal** (offline-first, instalable como PWA).
6. **Acceso compartido simple**: una sola contraseña para todo el grupo.

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | Vite + React + TypeScript, `vite-plugin-pwa` | SPA liviana. El shell queda cacheado y funciona offline |
| UI | Tailwind CSS | Sin runtime JS |
| Routing | React Router (o TanStack Router) | — |
| DB local | IndexedDB vía **Dexie** (+ `dexie-react-hooks` / `useLiveQuery`) | Fuente de verdad en el cliente. Lecturas y escrituras instantáneas |
| Backend | Vercel Functions en `/api` con **Hono** | Sin servidor que mantener |
| DB servidor | **Neon Postgres** (Vercel Marketplace) + **Drizzle ORM** | Free tier y serverless |
| Archivos | **Vercel Blob** (subida directa desde el cliente con `@vercel/blob/client`) | La base guarda solo URLs |
| PDF | **pdfmake** o **@react-pdf/renderer**, siempre con *lazy import* | Se genera en el navegador: funciona offline y no pesa en el arranque |
| Validación | Zod (compartido cliente/servidor) | — |

> Límites del plan Hobby de Vercel Blob: 1 GB de almacenamiento, 10 GB de transferencia por mes y 2.000 operaciones avanzadas (put/list/copy) por mes. Si se superan, el Blob se bloquea (no se cobra). Nunca usar `list()` desde la UI: las URLs se leen de la base.

## Modelo de datos

Decisión clave: **la revisión es el registro central**. Cada fila de la ficha es un campo de la revisión. El "estado actual" de una carpa es su revisión más reciente. No hace falta una tabla de "usos" aparte: tribu, dirigente y cantidad de personas quedan registrados en cada revisión, igual que en la ficha.

### `carpas`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid (generado en el cliente) | Para poder crear carpas offline |
| codigo | text, único, corto (ej. `C-07`) | Va impreso en la ficha para encontrar la carpa al cargar |
| nombre | text | "Nahuel 23", "Flecha Azul"… |
| tipo | enum `canadiense` \| `iglu` \| `otro` | |
| capacidad | int, null | Capacidad nominal |
| estado_general | enum `lista` \| `revisar` \| `reparar` \| `baja` | Reemplaza "LISTAAA", "Revisar por completo", "donar" |
| notas | text, null | Observaciones permanentes ("tratar con amor", "no tiene bolsa de parantes") |
| foto_principal_id | uuid, null | |
| created_at, updated_at | timestamptz | `updated_at` se usa para resolver conflictos |
| deleted_at | timestamptz, null | Borrado lógico (necesario para sincronizar) |

### `fotos`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | |
| carpa_id | uuid → carpas | |
| url, thumb_url | text | Vercel Blob. La miniatura mide ~400 px |
| orden | int | |
| created_at, deleted_at | | |

### `revisiones` (orden = filas de la ficha)
| Campo | Tipo | Fila de la ficha |
|---|---|---|
| id | uuid | |
| carpa_id | uuid → carpas | Nombre / tipo (se toman de la carpa) |
| fecha | date | fecha de revisión |
| bolsa_estado / bolsa_nota | enum / text | bolsa de estacas y de carpa |
| cuerpo_estado / cuerpo_nota | enum / text | cuerpo |
| cierres_estado / cierres_nota | enum / text | cierres |
| parantes_estado / parantes_nota | enum / text | parantes |
| estacas_cantidad | int, null | estacas (cantidad y estado) |
| estacas_estado / estacas_nota | enum / text | ídem |
| vientos_estado / vientos_nota | enum / text | vientos y ojales |
| sobretecho_estado / sobretecho_nota | enum / text | sobretecho |
| cantidad_personas | text | Texto libre ("7 sin bolso", "6 picunches") |
| tribu | text | tribu que la usó |
| dirigente_tribu | text | dirigente de la tribu a cargo |
| dirigente_comision | text | dirigente de la comisión (revisión) |
| observaciones | text | observaciones de la comisión |
| campa | text, null | No está en la ficha, pero sí en el Docs ("verano 2025") |
| created_at, updated_at, deleted_at | | |

`*_estado`: enum `bien` \| `regular` \| `mal` \| `falta`, nullable. Así se pueden filtrar y resaltar problemas. El `*_nota` guarda el texto tal cual lo escribieron en la ficha.

Las revisiones casi siempre se agregan y rara vez se editan, así que prácticamente no generan conflictos de sincronización.

## Sincronización offline

**Hay un único almacenamiento, compartido por todo el grupo**: una base Neon y un store de Blob. Cada dispositivo tiene una copia local en IndexedDB que se sincroniza con ese almacenamiento. Lo que modifica uno lo ven los demás una vez que el que editó sube sus cambios (push) y el otro los baja (pull). No es tiempo real: con señal, el retraso es de segundos a pocos minutos.

- Toda la UI lee y escribe **solo en Dexie**. Cada escritura agrega una entrada a una tabla `outbox` (`{entidad, id, op, payload, updated_at}`).
- Un `syncService` corre al abrir la app, en el evento `online` y cada N minutos con conexión:
  1. **Push**: `POST /api/sync/push` con el outbox. El servidor aplica *last-write-wins* por `updated_at`.
  2. **Pull**: `GET /api/sync/pull?since=<cursor>` devuelve las filas con `updated_at > cursor` (incluye los borrados lógicos).
- **Fotos**: se comprimen en el cliente (`browser-image-compression`, ~1600 px / ~200 KB, más una miniatura de ~400 px), se guardan como Blob en IndexedDB y se suben cuando hay señal (`upload()` con token de `/api/blob/upload`). Al subir se actualizan `url`/`thumb_url`.
- Además del intervalo, también se hace pull al volver el foco a la app (`visibilitychange`) y con "deslizar para actualizar".
- La UI muestra siempre un indicador "X cambios sin sincronizar · Última sincronización: hace N min".

### Indicadores de estado de subida (UX)

El usuario tiene que saber siempre si sus cambios ya están en el almacenamiento compartido.

- **Estado por registro**: se deriva del outbox. Si el id de un registro está en el outbox, el registro está pendiente.
  - ✓ **Subido**: no muestra nada, o un check gris discreto.
  - ⏱ **Pendiente de subir**: insignia ámbar en la tarjeta de la carpa, en la revisión y en cada foto.
  - ⟳ **Subiendo**: spinner.
  - ⚠ **Error**: insignia roja con botón "Reintentar" y el motivo (ej. "sesión vencida", "foto demasiado grande").
- **Indicador global** en el header, siempre visible:
  - "✓ Todo subido · hace 2 min"
  - "⏱ 3 cambios sin subir" (con conexión: "subiendo…")
  - "Sin conexión · 3 cambios guardados en este celular"
  - "⚠ Error al subir · Reintentar"
- Al tocar el indicador se abre la **pantalla "Pendientes"**: lista de cada cambio sin subir (ej. "Revisión de Nahuel 23 · 19/11", "Foto de Flecha Azul"), con su estado, un botón "Subir ahora" y, para cada error, el detalle.
- **Toast al reconectar**: "Se subieron 3 cambios ✓".
- **Persistencia**: al primer inicio llamar `navigator.storage.persist()` para que el navegador no borre IndexedDB por falta de espacio. Mostrar un aviso si se rechaza.
- **Protecciones**: si hay pendientes, avisar antes de cerrar sesión o de "borrar datos locales" ("Tenés 3 cambios sin subir. Si continuás, se pierden").
- Opcional: Background Sync API (solo Chrome/Android) para subir aunque la app esté cerrada. En iOS se sube al volver a abrir la app.

### Service worker

- Service worker (Workbox vía `vite-plugin-pwa`): precache del shell y *cache-first* para las miniaturas de Blob.

## Autenticación

- `POST /api/login` compara contra `APP_PASSWORD` (variable de entorno) y devuelve un JWT firmado (`jose`, `AUTH_SECRET`) de larga duración (ej. 180 días).
- El cliente lo guarda en localStorage. Offline no se pide login si ya hay token.
- Todos los endpoints `/api/*` (salvo login) exigen `Authorization: Bearer`.

## PDFs (generados en el cliente)

### Inventario
- Se puede abrir desde el listado con selección múltiple ("Seleccionar todas" / checkboxes) o desde una carpa.
- Opciones: ☐ incluir revisiones (todas / últimas N), ☐ incluir fotos.
- Una carpa por bloque: foto, datos de la carpa, estado actual (última revisión) y, si se pidió, tabla de revisiones anteriores. Resaltar los componentes en `regular`/`mal`/`falta`.

### Ficha de revisión
- Replica la ficha en papel: columna de etiquetas y 2 columnas de valores. Las filas, en orden: fecha de revisión, nombre, tipo, bolsa, cuerpo, cierres, parantes, estacas (cantidad y estado), vientos y ojales, sobretecho, cantidad de personas, tribu que la usó, dirigente de la tribu a cargo, dirigente de la comisión, observaciones de la comisión.
- Nombre y tipo vienen precargados en ambas columnas.
- Opción **"Precargar última revisión"** (activada por defecto): la columna 1 se completa con la última revisión y la columna 2 queda en blanco. Desactivada, ambas columnas salen en blanco (salvo nombre y tipo).
- Encabezado con el **código de la carpa** y un **QR** que abre `/carpas/:id/revision/nueva`, para cargar la ficha más rápido.
- Filas en blanco con altura suficiente para escribir a mano.
- Disposición: 1 ficha por A4 vertical. Opcional: 2 por hoja (A4 apaisada) para ahorrar papel.

## Pantallas

1. **Login**.
2. **Listado de carpas**: tarjetas con miniatura, nombre, tipo, estado general y fecha de la última revisión. Búsqueda, filtros (tipo, estado, "con problemas"), selección múltiple y acciones masivas (Exportar PDF, Generar fichas).
3. **Detalle de carpa**: fotos, datos, estado actual por componente, historial de revisiones y botones "Generar ficha" y "Cargar revisión".
4. **Alta/edición de carpa**: incluye tomar o subir foto.
5. **Cargar revisión**: formulario en el **mismo orden que la ficha**. Cada componente tiene chips de estado (Bien/Regular/Mal/Falta) y un campo de nota. Botón "Igual que la anterior" por fila. Los campos se precargan con la última revisión.
6. **Carga en lote**: después de una jornada de revisión, recorre las carpas seleccionadas una por una ("Guardar y siguiente").
7. **Ajustes**: estado de sincronización y forzar sync.

## Migración inicial desde el .docx

Script `scripts/import-docx.ts` (se corre una sola vez, local):
- Lee el .docx (`mammoth` o descomprimir el XML con `jszip`/`fast-xml-parser`). Cada carpa es una tabla de 2 columnas con filas FOTO, NOMBRE, TIPO, CHEQUEADA, BOLSA…, DIRIGENTE A CARGO.
- Los textos de las etiquetas varían ("BOLSA", "BOLSA y de estacas", "BOLSA carpa y estaca"…): mapearlos con coincidencia por prefijo y normalizados (sin tildes, en minúsculas).
- Extrae la imagen de cada tabla (relación `r:embed` → `word/media/imageN.jpg`), la comprime y la sube a Blob.
- Crea la carpa y **una revisión inicial** con los valores actuales. Si el campo es "bien" → `estado=bien`; si no, se deja el texto en `nota` y `estado=null` para revisarlo a mano.
- Los párrafos "ÚLTIMA REVISIÓN: 17/8 …" pasan a una revisión con esa fecha (sin año → 2026) y el texto en `observaciones`.
- Genera un reporte de lo que no pudo mapear.
- El .docx tiene nombres de personas: ponerlo en `scripts/data/` y agregarlo al `.gitignore`.

## Estructura del proyecto

```
/
├─ api/                    # Vercel Functions (Hono)
│  └─ [[...route]].ts      # login, sync/push, sync/pull, blob/upload
├─ server/
│  ├─ db/schema.ts         # Drizzle
│  ├─ db/client.ts         # Neon serverless driver
│  └─ auth.ts
├─ shared/                 # Zod schemas y tipos (cliente + servidor)
├─ src/
│  ├─ db/dexie.ts          # tablas locales + outbox
│  ├─ sync/                # syncService, uploader de fotos
│  ├─ pdf/                 # inventario.ts, ficha.ts (lazy)
│  ├─ pages/
│  ├─ components/
│  └─ main.tsx
├─ scripts/import-docx.ts
├─ drizzle.config.ts
└─ vite.config.ts          # + vite-plugin-pwa
```

Variables de entorno: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `APP_PASSWORD`, `AUTH_SECRET`.

## Hitos

1. **Base**: Vite + PWA + Tailwind, Hono en `/api`, Neon + Drizzle, login con contraseña compartida. Deploy en Vercel.
2. **Datos locales**: Dexie, ABM de carpas offline, listado y detalle.
3. **Sync**: outbox, push/pull, indicadores de estado (por registro y global), pantalla "Pendientes", `storage.persist()`.
4. **Fotos**: compresión, cola de subida a Blob, miniaturas.
5. **Revisiones**: formulario de carga (individual y en lote), historial.
6. **Ficha PDF**: con y sin precarga, individual y masiva, QR.
7. **Inventario PDF**: selección y opciones.
8. **Migración** del .docx e importación de los datos reales.
9. **Pulido**: filtros "con problemas", prueba en celular real en modo avión, Lighthouse (objetivo: JS inicial < 150 KB gzip).

## Decisiones abiertas

- ¿2 fichas por hoja o 1?
- ¿Hace falta registrar la campa en la revisión? (Está en el Docs, no en la ficha.)
- ¿Se quieren fotos por revisión (ej. del daño), además de las fotos de la carpa?
